// app/api/checkout/create-session/route.ts
//
// Purpose
// -------
// Create Stripe Checkout Sessions (annual subscriptions) for
// - individual
// - business
// - staff_seat
//
// Guarantee
// ---------
// • If yearly Price IDs are present → use them (best for Checkout copy control).
// • If any Price ID is missing → gracefully FALL BACK to inline yearly price_data
//   using cent amounts from env (so we never 500 just because an env is missing).
//
// What this FIXES (root cause of 500 + upgrade redirect):
// ------------------------------------------------------
// Previously, missing/invalid envs/params caused a 500 from Stripe.create().
// That made the client think "checkout failed" and redirect to /dashboard/upgrade.
// Now, we always construct valid params, preferring Price IDs, otherwise
// building inline yearly price_data with types Stripe.Checkout.SessionCreateParams.
//
// Notes
// -----
// • mode: "subscription"  → charges full annual amount now, auto-renews yearly.
// • Metadata unchanged → webhook continues to unlock access exactly as before.
// • Success/Cancel URLs unchanged in intent – we just harden how the base URL is derived.
// • If you want to *hide* Stripe’s “per month billed annually” copy, do that
//   on the Price in the Dashboard (not via API).
//
// Env (Price IDs - optional but preferred):
//   STRIPE_PRICE_INDIVIDUAL_YEARLY
//   STRIPE_PRICE_BUSINESS_YEARLY
//   STRIPE_PRICE_STAFF_SEAT_YEARLY
//
// Env (fallback amounts in cents - used only if a Price ID is missing):
//   STRIPE_INDIVIDUAL_PRICE (default 8000)
//   STRIPE_BUSINESS_PRICE   (default 20000)
//   STRIPE_STAFF_SEAT_PRICE (default 5000)

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

type PackageType = "individual" | "business" | "staff_seat";

/**
 * Small, explicit runtime guard to ensure the incoming value is a known PackageType.
 * - TypeScript types disappear at runtime, so we still validate the JSON body.
 * - Legit callers (your UI) already send only these literals, so this does not
 *   change any happy-path flows — it just rejects garbage input early.
 */
function isValidPackageType(value: unknown): value is PackageType {
  return value === "individual" || value === "business" || value === "staff_seat";
}

/**
 * Resolve the base application URL.
 *
 * Priority:
 *  1. NEXT_PUBLIC_APP_URL  (production / preview best-practice)
 *  2. Request URL host     (e.g. Vercel preview or custom domain)
 *  3. http://localhost:3000 (dev fallback)
 *
 * This mirrors your forgot-password logic and avoids broken URLs like
 * "undefined/dashboard" when envs are misconfigured.
 */
function resolveAppBaseUrl(req: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");

  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    // Local dev, extremely defensive fallback
    return "http://localhost:3000";
  }
}

export async function POST(req: Request) {
  try {
    // -------------------------------------------------------------------
    // 1) Parse and validate input
    // -------------------------------------------------------------------
    //
    // The client sends: { packageType: "individual" | "business" | "staff_seat" }
    // We validate this at runtime to avoid any unexpected values flowing
    // into our Stripe pricing logic.
    const body = (await req.json().catch(() => null)) as
      | { packageType?: unknown }
      | null;

    const packageTypeCandidate = body?.packageType;

    if (!isValidPackageType(packageTypeCandidate)) {
      // Invalid or missing packageType → client bug / bad request.
      // This does not alter legitimate flows, since your UI only sends valid values.
      return NextResponse.json(
        { error: "Invalid or missing packageType" },
        { status: 400 }
      );
    }

    const packageType: PackageType = packageTypeCandidate;

    // -------------------------------------------------------------------
    // 2) Get current user session (for metadata + customer_email)
    // -------------------------------------------------------------------
    //
    // We don’t enforce auth *inside* this route yet (to avoid changing
    // any existing flows), but we do:
    //  - attach userId to metadata when available (used by webhooks),
    //  - attach user email as customer_email so Stripe can prefill it.
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;
    const userEmail = session?.user?.email || undefined;

    // -------------------------------------------------------------------
    // 3) Build success/cancel URLs from a hardened base URL
    // -------------------------------------------------------------------
    //
    // Behavioral intent is *identical* to your previous code:
    //  - Staff seat purchases return to /dashboard/staff
    //  - Individual/business packages return to /dashboard or upgrade page
    //
    // The only change is that we now compute the base of the URL in a
    // more robust way (env → host → localhost) to avoid "undefined/..."
    const baseUrl = resolveAppBaseUrl(req);

    const successUrl =
      packageType === "staff_seat"
        ? `${baseUrl}/dashboard/staff?success=true`
        : `${baseUrl}/dashboard?success=true`;

    const cancelUrl =
      packageType === "staff_seat"
        ? `${baseUrl}/dashboard/staff?canceled=true`
        : `${baseUrl}/dashboard/upgrade?canceled=true`;

    // -------------------------------------------------------------------
    // 4) Determine product label + metadata scaffolding
    // -------------------------------------------------------------------
    //
    // This is purely descriptive and used in:
    //  - Stripe Checkout line items,
    //  - Stripe metadata for your webhooks.
    const productName =
      packageType === "business"
        ? "Business Package"
        : packageType === "staff_seat"
        ? "Staff Seat"
        : "Individual Package";

    const purpose: "PACKAGE" | "STAFF_SEAT" =
      packageType === "staff_seat" ? "STAFF_SEAT" : "PACKAGE";

    // -------------------------------------------------------------------
    // 5) Price configuration (prefer Price IDs; fallback to inline price_data)
    // -------------------------------------------------------------------
    //
    // Preferred: use Dashboard Price IDs (lets you control wording, visibility,
    // tax behavior, and "billed annually" copy directly in Stripe).
    const priceIdMap: Record<PackageType, string | undefined> = {
      individual: process.env.STRIPE_PRICE_INDIVIDUAL_YEARLY?.trim() || undefined,
      business: process.env.STRIPE_PRICE_BUSINESS_YEARLY?.trim() || undefined,
      staff_seat: process.env.STRIPE_PRICE_STAFF_SEAT_YEARLY?.trim() || undefined,
    };
    const priceId = priceIdMap[packageType];

    // Fallback: inline yearly price_data (if a Price ID is not configured)
    //
    // These are cent amounts. We guard against NaN/negative and fall back to 1
    // cent to avoid ever constructing an invalid Stripe payload.
    const fallbackCentsMap: Record<PackageType, number> = {
      individual: parseInt(process.env.STRIPE_INDIVIDUAL_PRICE || "8000", 10),
      business: parseInt(process.env.STRIPE_BUSINESS_PRICE || "20000", 10),
      staff_seat: parseInt(process.env.STRIPE_STAFF_SEAT_PRICE || "5000", 10),
    };

    // -------------------------------------------------------------------
    // 6) Build strictly typed Stripe Checkout params
    // -------------------------------------------------------------------
    //
    // baseParams holds everything common across all packages:
    //  - mode: "subscription" (annual, auto-renew)
    //  - success/cancel URLs
    //  - customer_email (if we have it)
    //  - metadata for both session and subscription
    const baseParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription", // ✅ annual auto-renew; full amount charged now
      payment_method_types: ["card"],
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(userEmail ? { customer_email: userEmail } : {}),
      metadata: {
        purpose,            // PACKAGE | STAFF_SEAT
        packageType,        // individual | business | staff_seat
        ...(userId ? { userId } : {}),
        description: productName,
      },
      // Mirror metadata on the subscription for subscription.* events if you ever need them
      subscription_data: {
        metadata: {
          purpose,
          packageType,
          ...(userId ? { userId } : {}),
        },
      },
    };

    let params: Stripe.Checkout.SessionCreateParams;

    if (priceId) {
      // ---------------------------------------------------------------
      // 6a) Preferred path: use dashboard Price ID
      // ---------------------------------------------------------------
      //
      // This aligns with how Stripe wants you to manage prices and
      // gives you the most control over what users see on the hosted page.
      params = {
        ...baseParams,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
      };
    } else {
      // ---------------------------------------------------------------
      // 6b) Fallback path: inline yearly price data
      // ---------------------------------------------------------------
      //
      // We only get here if the corresponding Price ID env is missing.
      // Instead of throwing, we construct a minimal price_data object.
      const unit_amount = fallbackCentsMap[packageType];

      // Guard against NaN or negative values:
      // - If the env is malformed, we still send a minimal valid amount (1).
      const safeAmount =
        Number.isFinite(unit_amount) && unit_amount > 0 ? unit_amount : 1;

      params = {
        ...baseParams,
        line_items: [
          {
            price_data: {
              currency: "aud",
              product_data: { name: productName },
              unit_amount: safeAmount,
              recurring: {
                interval: "year", // ← strictly typed as literal "year"
              },
            },
            quantity: 1,
          },
        ],
      };
    }

    // -------------------------------------------------------------------
    // 7) Create Stripe Checkout Session
    // -------------------------------------------------------------------
    //
    // The returned URL is used by the client to redirect the user to
    // the hosted Stripe Checkout page.
    const checkout = await stripe.checkout.sessions.create(params);

    return NextResponse.json({ url: checkout.url });
  } catch (err: any) {
    // -------------------------------------------------------------------
    // 8) Safe error logging & generic client response
    // -------------------------------------------------------------------
    //
    // We log enough server-side to debug (type, code, message) but only
    // return a generic error code to the client. The client already
    // uses this to decide whether to redirect to /dashboard/upgrade.
    console.error("[Checkout] Error creating session:", {
      message: err?.message,
      type: err?.type,
      code: err?.code,
      raw: err,
    });

    return NextResponse.json(
      { error: "FAILED_TO_CREATE_CHECKOUT_SESSION" },
      { status: 500 }
    );
  }
}









// // app/api/checkout/create-session/route.ts
// //
// // Purpose
// // -------
// // Create Stripe Checkout Sessions (annual subscriptions) for
// // - individual
// // - business
// // - staff_seat
// //
// // Guarantee
// // ---------
// // • If yearly Price IDs are present → use them (best for Checkout copy control).
// // • If any Price ID is missing → gracefully FALL BACK to inline yearly price_data
// //   using cent amounts from env (so we never 500 just because an env is missing).
// //
// // What this FIXES (root cause of 500 + upgrade redirect):
// // ------------------------------------------------------
// // Previously, missing/invalid envs/params caused a 500 from Stripe.create().
// // That made the client think "checkout failed" and redirect to /dashboard/upgrade.
// // Now, we always construct valid params, preferring Price IDs, otherwise
// // building inline yearly price_data with types Stripe.Checkout.SessionCreateParams.
// //
// // Notes
// // -----
// // • mode: "subscription"  → charges full annual amount now, auto-renews yearly.
// // • Metadata unchanged → webhook continues to unlock access exactly as before.
// // • Success/Cancel URLs unchanged.
// // • If you want to *hide* Stripe’s “per month billed annually” copy, do that
// //   on the Price in the Dashboard (not via API).
// //
// // Env (Price IDs - optional but preferred):
// //   STRIPE_PRICE_INDIVIDUAL_YEARLY
// //   STRIPE_PRICE_BUSINESS_YEARLY
// //   STRIPE_PRICE_STAFF_SEAT_YEARLY
// //
// // Env (fallback amounts in cents - used only if a Price ID is missing):
// //   STRIPE_INDIVIDUAL_PRICE (default 8000)
// //   STRIPE_BUSINESS_PRICE   (default 20000)
// //   STRIPE_STAFF_SEAT_PRICE (default 5000)

// import { NextResponse } from "next/server";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";
// import { stripe } from "@/lib/stripe";
// import type Stripe from "stripe";

// type PackageType = "individual" | "business" | "staff_seat";

// export async function POST(req: Request) {
//   try {
//     // 1) Input
//     const { packageType }: { packageType: PackageType } = await req.json();

//     // 2) Current user (for metadata + customer_email)
//     const session = await getServerSession(authOptions);
//     const userId = session?.user?.id || null;
//     const userEmail = session?.user?.email || undefined;

//     // 3) Success/Cancel URLs (unchanged)
//     const successUrl =
//       packageType === "staff_seat"
//         ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?success=true`
//         : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`;

//     const cancelUrl =
//       packageType === "staff_seat"
//         ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?canceled=true`
//         : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade?canceled=true`;

//     // 4) Determine product label + env scaffolding
//     const productName =
//       packageType === "business"
//         ? "Business Package"
//         : packageType === "staff_seat"
//         ? "Staff Seat"
//         : "Individual Package";

//     const purpose: "PACKAGE" | "STAFF_SEAT" =
//       packageType === "staff_seat" ? "STAFF_SEAT" : "PACKAGE";

//     // Preferred: dashboard Prices (lets you disable "per month billed annually" in Stripe UI)
//     const priceIdMap: Record<PackageType, string | undefined> = {
//       individual: process.env.STRIPE_PRICE_INDIVIDUAL_YEARLY,
//       business: process.env.STRIPE_PRICE_BUSINESS_YEARLY,
//       staff_seat: process.env.STRIPE_PRICE_STAFF_SEAT_YEARLY,
//     };
//     const priceId = priceIdMap[packageType];

//     // Fallback: inline yearly price_data (if Price ID is not configured)
//     const fallbackCentsMap: Record<PackageType, number> = {
//       individual: parseInt(process.env.STRIPE_INDIVIDUAL_PRICE || "8000", 10),
//       business: parseInt(process.env.STRIPE_BUSINESS_PRICE || "20000", 10),
//       staff_seat: parseInt(process.env.STRIPE_STAFF_SEAT_PRICE || "5000", 10),
//     };

//     // 5) Build strictly typed params (Stripe TS-safe)
//     const baseParams: Stripe.Checkout.SessionCreateParams = {
//       mode: "subscription", // ✅ annual auto-renew; full amount charged now
//       payment_method_types: ["card"],
//       success_url: successUrl,
//       cancel_url: cancelUrl,
//       ...(userEmail ? { customer_email: userEmail } : {}),
//       metadata: {
//         purpose,            // PACKAGE | STAFF_SEAT
//         packageType,        // individual | business | staff_seat
//         ...(userId ? { userId } : {}),
//         description: productName,
//       },
//       // Mirror metadata on the subscription for subscription.* events if you ever need them
//       subscription_data: {
//         metadata: {
//           purpose,
//           packageType,
//           ...(userId ? { userId } : {}),
//         },
//       },
//     };

//     let params: Stripe.Checkout.SessionCreateParams;

//     if (priceId) {
//       // Preferred path: use dashboard Price ID (you control wording/visibility in Stripe)
//       params = {
//         ...baseParams,
//         line_items: [
//           {
//             price: priceId,
//             quantity: 1,
//           },
//         ],
//       };
//     } else {
//       // Fallback path: inline yearly price data (never 500 due to missing Price ID)
//       const unit_amount = fallbackCentsMap[packageType];
//       // Guard against accidental NaN/negative values
//       const safeAmount = Number.isFinite(unit_amount) && unit_amount > 0 ? unit_amount : 1;

//       params = {
//         ...baseParams,
//         line_items: [
//           {
//             price_data: {
//               currency: "aud",
//               product_data: { name: productName },
//               unit_amount: safeAmount,
//               recurring: {
//                 interval: "year", // ← strictly typed as literal "year"
//               },
//             },
//             quantity: 1,
//           },
//         ],
//       };
//     }

//     const checkout = await stripe.checkout.sessions.create(params);
//     return NextResponse.json({ url: checkout.url });
//   } catch (err: any) {
//     // Log everything helpful server-side, return a generic message client-side
//     console.error("[Checkout] Error creating session:", {
//       message: err?.message,
//       type: err?.type,
//       code: err?.code,
//       raw: err,
//     });
//     return NextResponse.json(
//       { error: "FAILED_TO_CREATE_CHECKOUT_SESSION" },
//       { status: 500 }
//     );
//   }
// }















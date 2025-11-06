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
// • Success/Cancel URLs unchanged.
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

export async function POST(req: Request) {
  try {
    // 1) Input
    const { packageType }: { packageType: PackageType } = await req.json();

    // 2) Current user (for metadata + customer_email)
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;
    const userEmail = session?.user?.email || undefined;

    // 3) Success/Cancel URLs (unchanged)
    const successUrl =
      packageType === "staff_seat"
        ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?success=true`
        : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`;

    const cancelUrl =
      packageType === "staff_seat"
        ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?canceled=true`
        : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade?canceled=true`;

    // 4) Determine product label + env scaffolding
    const productName =
      packageType === "business"
        ? "Business Package"
        : packageType === "staff_seat"
        ? "Staff Seat"
        : "Individual Package";

    const purpose: "PACKAGE" | "STAFF_SEAT" =
      packageType === "staff_seat" ? "STAFF_SEAT" : "PACKAGE";

    // Preferred: dashboard Prices (lets you disable "per month billed annually" in Stripe UI)
    const priceIdMap: Record<PackageType, string | undefined> = {
      individual: process.env.STRIPE_PRICE_INDIVIDUAL_YEARLY,
      business: process.env.STRIPE_PRICE_BUSINESS_YEARLY,
      staff_seat: process.env.STRIPE_PRICE_STAFF_SEAT_YEARLY,
    };
    const priceId = priceIdMap[packageType];

    // Fallback: inline yearly price_data (if Price ID is not configured)
    const fallbackCentsMap: Record<PackageType, number> = {
      individual: parseInt(process.env.STRIPE_INDIVIDUAL_PRICE || "8000", 10),
      business: parseInt(process.env.STRIPE_BUSINESS_PRICE || "20000", 10),
      staff_seat: parseInt(process.env.STRIPE_STAFF_SEAT_PRICE || "5000", 10),
    };

    // 5) Build strictly typed params (Stripe TS-safe)
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
      // Preferred path: use dashboard Price ID (you control wording/visibility in Stripe)
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
      // Fallback path: inline yearly price data (never 500 due to missing Price ID)
      const unit_amount = fallbackCentsMap[packageType];
      // Guard against accidental NaN/negative values
      const safeAmount = Number.isFinite(unit_amount) && unit_amount > 0 ? unit_amount : 1;

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

    const checkout = await stripe.checkout.sessions.create(params);
    return NextResponse.json({ url: checkout.url });
  } catch (err: any) {
    // Log everything helpful server-side, return a generic message client-side
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
// // Create Stripe Checkout Sessions securely.
// // - Uses server-side env amounts (never trust client)
// // - Writes metadata for robust webhook handling
// // - Returns dashboard success/cancel URLs so we don't bounce back to /services
// //
// // 🔧 Robustness addition:
// // - Provide `customer_email` when a session user exists so the webhook can
// //   always attribute the payment via email fallback (if metadata.userId is absent).

// import { NextResponse } from "next/server";
// import { stripe } from "@/lib/stripe";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";

// type PackageType = "individual" | "business" | "staff_seat";

// export async function POST(req: Request) {
//   try {
//     const { packageType }: { packageType: PackageType } = await req.json();

//     let amount: number;
//     let productName: string;

//     switch (packageType) {
//       case "individual":
//         amount = parseInt(process.env.STRIPE_INDIVIDUAL_PRICE || "8000", 10);
//         productName = "Individual Package";
//         break;
//       case "business":
//         amount = parseInt(process.env.STRIPE_BUSINESS_PRICE || "20000", 10);
//         productName = "Business Package";
//         break;
//       case "staff_seat":
//         amount = parseInt(process.env.STRIPE_STAFF_SEAT_PRICE || "5000", 10);
//         productName = "Staff Seat";
//         break;
//       default:
//         return NextResponse.json({ error: "Invalid package type" }, { status: 400 });
//     }

//     const session = await getServerSession(authOptions);
//     const userId = session?.user?.id || null;
//     const userEmail = session?.user?.email || undefined;

//     // Return to the correct area of the dashboard after payment/cancel.
//     const successUrl =
//       packageType === "staff_seat"
//         ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?success=true`
//         : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`;

//     const cancelUrl =
//       packageType === "staff_seat"
//         ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?canceled=true`
//         : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade?canceled=true`;

//     const checkout = await stripe.checkout.sessions.create({
//       mode: "payment",
//       payment_method_types: ["card"],
//       line_items: [
//         {
//           price_data: {
//             currency: "aud",
//             product_data: { name: productName },
//             unit_amount: amount,
//           },
//           quantity: 1,
//         },
//       ],
//       success_url: successUrl,
//       cancel_url: cancelUrl,

//       // ✅ Ensures webhook can attribute payer even if userId metadata is missing
//       ...(userEmail ? { customer_email: userEmail } : {}),

//       // Metadata used by webhook
//       metadata: {
//         purpose: packageType === "staff_seat" ? "STAFF_SEAT" : "PACKAGE",
//         packageType,
//         description: productName,
//         ...(userId ? { userId } : {}),
//       },
//     });

//     return NextResponse.json({ url: checkout.url });
//   } catch (err: any) {
//     console.error("[Checkout] Error creating session:", err);
//     return NextResponse.json(
//       { error: err.message || "Failed to create session" },
//       { status: 500 }
//     );
//   }
// }

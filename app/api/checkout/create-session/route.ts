// app/api/checkout/create-session/route.ts
//
// Purpose
// -------
// Create Stripe *subscription* Checkout Sessions securely (yearly).
// - Primary path: use yearly Price IDs from env (mode: "subscription").
// - Fallback path: inline price_data with recurring.year using your existing amount envs.
// - Keep metadata on both the session and subscription (webhook attribution).
//
// Why you saw TS errors
// ---------------------
// TS inferred the wrong overload (RequestOptions) because line_items had a widened union.
// By explicitly typing the params as `Stripe.Checkout.SessionCreateParams` and the
// line items as `Stripe.Checkout.SessionCreateParams.LineItem[]`, we force the correct
// overload and preserve `"year"` as a literal Interval.
//
// ZERO changes to your surrounding flows and URLs.
//
// Preferred ENV:
//  - STRIPE_PRICE_INDIVIDUAL_YEARLY
//  - STRIPE_PRICE_BUSINESS_YEARLY
//  - STRIPE_PRICE_STAFF_SEAT_YEARLY
//
// Fallback ENV (cents) used only if a price id is missing:
//  - STRIPE_INDIVIDUAL_PRICE (default "8000")
//  - STRIPE_BUSINESS_PRICE   (default "20000")
//  - STRIPE_STAFF_SEAT_PRICE (default "5000")

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

type PackageType = "individual" | "business" | "staff_seat";

/** Helper: read integer cents from env with safe default. */
function cents(envValue: string | undefined, fallback: number): number {
  const n = parseInt(envValue ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function POST(req: Request) {
  try {
    // 1) Parse body
    const { packageType }: { packageType: PackageType } = await req.json();

    // Product label (for inline price_data fallback + metadata)
    const productNameMap: Record<PackageType, string> = {
      individual: "Individual Package",
      business: "Business Package",
      staff_seat: "Staff Seat",
    };
    const productName = productNameMap[packageType];

    // Preferred yearly Price IDs (dashboard-managed)
    const priceIdMap: Record<PackageType, string | undefined> = {
      individual: process.env.STRIPE_PRICE_INDIVIDUAL_YEARLY,
      business: process.env.STRIPE_PRICE_BUSINESS_YEARLY,
      staff_seat: process.env.STRIPE_PRICE_STAFF_SEAT_YEARLY,
    };
    const priceId = priceIdMap[packageType];

    // Fallback inline amounts (cents) if priceId is not configured
    const amountMap: Record<PackageType, number> = {
      individual: cents(process.env.STRIPE_INDIVIDUAL_PRICE, 8000),
      business: cents(process.env.STRIPE_BUSINESS_PRICE, 20000),
      staff_seat: cents(process.env.STRIPE_STAFF_SEAT_PRICE, 5000),
    };
    const amountCents = amountMap[packageType];

    // 2) Current session user → for metadata + email convenience
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;
    const userEmail = session?.user?.email || undefined;

    // 3) Success/Cancel URLs (unchanged UX)
    const successUrl =
      packageType === "staff_seat"
        ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?success=true`
        : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`;

    const cancelUrl =
      packageType === "staff_seat"
        ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?canceled=true`
        : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade?canceled=true`;

    // 4) Metadata copied to session + subscription for webhook attribution
    const purpose: "PACKAGE" | "STAFF_SEAT" = packageType === "staff_seat" ? "STAFF_SEAT" : "PACKAGE";
    const baseMeta = {
      purpose,                 // PACKAGE | STAFF_SEAT
      packageType,             // individual | business | staff_seat
      ...(userId ? { userId } : {}),
      description: productName,
    };

    // 5) Build strongly-typed line items (keeps "year" as literal Interval)
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
      ? [
          // Preferred: use configured yearly Price ID
          {
            price: priceId,
            quantity: 1,
          },
        ]
      : [
          // Fallback: inline price_data with recurring yearly
          {
            price_data: {
              currency: "aud",
              product_data: { name: productName },
              unit_amount: amountCents,
              recurring: { interval: "year" }, // literal type, not widened to string
            },
            quantity: 1,
          },
        ];

    // 6) Construct params as Stripe.Checkout.SessionCreateParams
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: lineItems,
      ...(userEmail ? { customer_email: userEmail } : {}),
      metadata: baseMeta, // for checkout.session.completed if you use it
      subscription_data: {
        metadata: {
          // copy to the subscription (so customer.subscription.* webhooks can attribute)
          purpose,
          packageType,
          ...(userId ? { userId } : {}),
        },
      },
    };

    // 7) Create session with correctly-typed params
    const checkout = await stripe.checkout.sessions.create(params);

    return NextResponse.json({ url: checkout.url });
  } catch (err: any) {
    // Structured log so you can diagnose quickly in Vercel logs if needed
    console.error("[Checkout] Error creating session:", {
      message: err?.message,
      type: err?.type,
      code: err?.code,
      stack: err?.stack,
    });
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
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

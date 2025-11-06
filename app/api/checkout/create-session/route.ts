// app/api/checkout/create-session/route.ts
//
// Purpose
// -------
// Create Stripe Checkout Sessions securely.
// - Now uses *subscriptions* with yearly prices (mode: "subscription").
// - We still keep the exact branching for packageType ("individual" | "business" | "staff_seat").
// - We *copy* user metadata onto the Subscription via `subscription_data.metadata` so that
//   later `customer.subscription.*` webhooks can reliably map the event to a user *without*
//   requiring extra DB fields.
//
// Security / Robustness
// ---------------------
// - Price IDs are taken from env (server-side) — never trust client.
// - `customer_email` aids Stripe reconciliation but metadata remains the source of truth.
// - Success/cancel URLs are unchanged and still land on the dashboard.
//
// ENV (new):
// ----------
// STRIPE_PRICE_INDIVIDUAL_YEARLY
// STRIPE_PRICE_BUSINESS_YEARLY
// STRIPE_PRICE_STAFF_SEAT_YEARLY
//
// Note: Keep your existing NEXT_PUBLIC_* price label vars for UI only;
//        these new STRIPE_PRICE_*_YEARLY are authoritative for Stripe.

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type PackageType = "individual" | "business" | "staff_seat";

export async function POST(req: Request) {
  try {
    const { packageType }: { packageType: PackageType } = await req.json();

    // 1) Resolve the correct *yearly* price id from env (authoritative, server-side)
    const priceIdMap: Record<PackageType, string | undefined> = {
      individual: process.env.STRIPE_PRICE_INDIVIDUAL_YEARLY,
      business: process.env.STRIPE_PRICE_BUSINESS_YEARLY,
      staff_seat: process.env.STRIPE_PRICE_STAFF_SEAT_YEARLY,
    };

    const productNameMap: Record<PackageType, string> = {
      individual: "Individual Package",
      business: "Business Package",
      staff_seat: "Staff Seat",
    };

    const priceId = priceIdMap[packageType];
    const productName = productNameMap[packageType];

    if (!priceId) {
      // If the env is missing, fail fast and *clearly*.
      return NextResponse.json(
        {
          error: "Missing Stripe price id for selected packageType",
          hint: {
            packageType,
            expectedEnv:
              packageType === "individual"
                ? "STRIPE_PRICE_INDIVIDUAL_YEARLY"
                : packageType === "business"
                ? "STRIPE_PRICE_BUSINESS_YEARLY"
                : "STRIPE_PRICE_STAFF_SEAT_YEARLY",
          },
        },
        { status: 500 }
      );
    }

    // 2) Identify the current user (for metadata + receipt email)
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;
    const userEmail = session?.user?.email || undefined;

    // 3) Destination URLs (unchanged UX)
    const successUrl =
      packageType === "staff_seat"
        ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?success=true`
        : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`;

    const cancelUrl =
      packageType === "staff_seat"
        ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?canceled=true`
        : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade?canceled=true`;

    // 4) Create a *subscription* checkout — not a one-time payment anymore.
    //    We put metadata in two places:
    //      a) session.metadata  → keeps your existing checkout.session.completed logic happy
    //      b) subscription_data.metadata → ensures subsequent customer.subscription.* webhooks
    //         also carry userId/packageType/purpose so we can flip hasPaid accurately.
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription", // ← switched from "payment" to "subscription"
      payment_method_types: ["card"],

      line_items: [
        {
          price: priceId, // price configured in Stripe Dashboard as "yearly"
          quantity: 1,
        },
      ],

      // Where to send the user afterwards (unchanged)
      success_url: successUrl,
      cancel_url: cancelUrl,

      // Email helps Stripe reconcile; authZ still relies on metadata.
      ...(userEmail ? { customer_email: userEmail } : {}),

      // (a) Session metadata — preserves your existing webhook behavior.
      metadata: {
        purpose: packageType === "staff_seat" ? "STAFF_SEAT" : "PACKAGE",
        packageType,
        description: productName,
        ...(userId ? { userId } : {}),
      },

      // (b) Copy metadata *onto the Subscription itself*
      subscription_data: {
        metadata: {
          purpose: packageType === "staff_seat" ? "STAFF_SEAT" : "PACKAGE",
          packageType,
          ...(userId ? { userId } : {}),
        },
      },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (err: any) {
    console.error("[Checkout] Error creating session:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create session" },
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

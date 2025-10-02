// app/api/checkout/create-session/route.ts
//
// Purpose:
// - Securely creates Stripe Checkout Sessions from the server.
// - Supports multiple package types: "individual", "business", "staff_seat".
// - Prices are pulled from server-side env vars (cents).
//
// Updates in this version:
// - If the user is logged in, success/cancel URLs now target internal dashboard routes:
//     success: /dashboard?success=true
//     cancel:  /dashboard/upgrade?canceled=true
//   (This fixes the issue where successful payments returned to the public /services page.)
// - Adds `metadata.userId` (when logged in) so the webhook can attach the payment to the right user.
// - Adds `metadata.description` to create clear human-readable payment descriptions in DB.
//
// Security:
// - Never trust client price; always resolve on server from STRIPE_* env vars.

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type PackageType = "individual" | "business" | "staff_seat";

export async function POST(req: Request) {
  try {
    const { packageType }: { packageType: PackageType } = await req.json();

    let amount: number;
    let productName: string;

    switch (packageType) {
      case "individual":
        amount = parseInt(process.env.STRIPE_INDIVIDUAL_PRICE || "8000", 10);
        productName = "Individual Package";
        break;
      case "business":
        amount = parseInt(process.env.STRIPE_BUSINESS_PRICE || "20000", 10);
        productName = "Business Package";
        break;
      case "staff_seat":
        amount = parseInt(process.env.STRIPE_STAFF_SEAT_PRICE || "5000", 10);
        productName = "Staff Seat";
        break;
      default:
        return NextResponse.json({ error: "Invalid package type" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const isLoggedIn = Boolean(session?.user?.id);
    const userId = session?.user?.id || null;

    const successUrl =
      packageType === "staff_seat"
        ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?success=true`
        : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`;

    const cancelUrl =
      packageType === "staff_seat"
        ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?canceled=true`
        : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade?canceled=true`;

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: { name: productName },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        purpose: packageType === "staff_seat" ? "STAFF_SEAT" : "PACKAGE",
        packageType,
        description: productName,
        ...(isLoggedIn && userId ? { userId } : {}),
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
// // Purpose:
// // - Securely creates Stripe Checkout Sessions from the server.
// // - Supports multiple package types: "individual", "business", "staff_seat".
// // - Prices are pulled from server-side env vars (cents).
// //
// // Updates in this version:
// // - If the user is logged in, success/cancel URLs now target internal dashboard routes:
// //     success: /dashboard?success=true
// //     cancel:  /dashboard/upgrade?canceled=true
// //   (This fixes the issue where successful payments returned to the public /services page.)
// // - Adds `metadata.userId` (when logged in) so the webhook can attach the payment to the right user.
// // - Adds `metadata.description` to create clear human-readable payment descriptions in DB.
// //
// // Security:
// // - Never trust client price; always resolve on server from STRIPE_* env vars.

// import { NextResponse } from "next/server";
// import { stripe } from "@/lib/stripe";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";

// // ✅ Allowed package types
// type PackageType = "individual" | "business" | "staff_seat";

// export async function POST(req: Request) {
//   try {
//     // 1) Parse packageType from client request
//     const { packageType }: { packageType: PackageType } = await req.json();

//     // 2) Resolve price + product name from env vars (always in cents)
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

//     // 3) If user is logged in, we can redirect inside the dashboard and attach userId
//     const session = await getServerSession(authOptions);
//     const isLoggedIn = Boolean(session?.user?.id);
//     const userId = session?.user?.id || null;

//     // 4) Choose success/cancel URLs
//     //    - For packages, we return to internal dashboard (success/cancel) for better UX.
//     //    - For staff seats, your /api/staff/add route already sets staff-specific URLs,
//     //      so we generally won't use this path for seats. Still safe if called.
//     const successUrl =
//       packageType === "staff_seat"
//         ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?success=true`
//         : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`;

//     const cancelUrl =
//       packageType === "staff_seat"
//         ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?canceled=true`
//         : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade?canceled=true`;

//     // 5) Create Stripe Checkout Session
//     const checkout = await stripe.checkout.sessions.create({
//       mode: "payment",
//       payment_method_types: ["card"], // test with 4242 4242 4242 4242
//       line_items: [
//         {
//           price_data: {
//             currency: "aud",
//             product_data: { name: productName },
//             unit_amount: amount, // cents
//           },
//           quantity: 1,
//         },
//       ],
//       success_url: successUrl,
//       cancel_url: cancelUrl,
//       // ✅ Metadata is how we tell the webhook who and what this payment is for
//       metadata: {
//         purpose: packageType === "staff_seat" ? "STAFF_SEAT" : "PACKAGE",
//         packageType,
//         description: productName,
//         ...(isLoggedIn && userId ? { userId } : {}), // only include if we have it
//       },
//     });

//     // 6) Respond with Checkout URL for browser redirect
//     return NextResponse.json({ url: checkout.url });
//   } catch (err: any) {
//     console.error("[Checkout] Error creating session:", err);
//     return NextResponse.json(
//       { error: err.message || "Failed to create session" },
//       { status: 500 }
//     );
//   }
// }

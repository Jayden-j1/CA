// app/api/payments/route.ts
//
// Purpose:
// - Handles starting a Stripe Checkout session.
// - Any logged-in user (USER, BUSINESS_OWNER, ADMIN) can purchase.
// - Individual users → buy course access.
// - Business owners → buy access for themselves OR when adding staff.
// - Staff → can also purchase access if required.
//
// Notes:
// - We removed the restriction that blocked "USER" accounts from paying.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

// ✅ Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    // 1. Ensure the user is logged in
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request body (amount in dollars, currency, description)
    const { amount, currency, description } = await req.json();

    if (!amount || !currency || !description) {
      return NextResponse.json(
        { error: "Missing payment details" },
        { status: 400 }
      );
    }

    // ❌ OLD: blocked USER role
    // ✅ NEW: allow USER + BUSINESS_OWNER + ADMIN
    // (All account types can create payments)

    // 3. Create Stripe Checkout session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: description },
            unit_amount: Math.round(amount * 100), // Stripe wants cents
          },
          quantity: 1,
        },
      ],
      // Redirect after payment (success/fail)
      success_url: `${process.env.NEXTAUTH_URL}/dashboard/map?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/upgrade?canceled=true`,
      metadata: {
        userId: session.user.id, // link payment to user
        description,
      },
    });

    // 4. Return the checkout URL
    return NextResponse.json({ url: stripeSession.url });
  } catch (error) {
    console.error("Stripe payment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}









// import { NextRequest, NextResponse } from "next/server";
// import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/lib/auth";
// // Optional: could be used to log "pending payments" before redirecting to Stripe
// import { prisma } from "@/lib/prisma";
// import Stripe from "stripe";

// //  Safe Stripe client initialization
// // Uses your Secret Key from .env.local or Vercel
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// export async function POST(req: NextRequest) {
//   try {
//     // 1️ Ensure user is logged in
//     const session = await getServerSession(authOptions);
//     if (!session?.user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     // 2️ Parse request body
//     const { amount, currency, description } = await req.json();

//     // 3️ (Optional) Restrict to business owners only
//     if (session.user.role === "USER") {
//       return NextResponse.json(
//         { error: "Users cannot make this payment" },
//         { status: 403 }
//       );
//     }

//     // 4️ Create Stripe Checkout session
//     const stripeSession = await stripe.checkout.sessions.create({
//       payment_method_types: ["card"],
//       mode: "payment",
//       line_items: [
//         {
//           price_data: {
//             currency,
//             product_data: { name: description },
//             unit_amount: Math.round(amount * 100), // Stripe expects cents
//           },
//           quantity: 1,
//         },
//       ],
//       success_url: `${process.env.NEXTAUTH_URL}/dashboard/staff?success=true`,
//       cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/staff?canceled=true`,
//       metadata: {
//         userId: session.user.id, // Useful in webhook to link payment → user
//         description,
//       },
//     });

//     // 5️ Send Checkout session URL to frontend
//     return NextResponse.json({ url: stripeSession.url });
//   } catch (error) {
//     console.error("Stripe payment error:", error);
//     return NextResponse.json({ error: "Internal server error" }, { status: 500 });
//   }
// }

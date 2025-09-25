// app/api/payments/route.ts
//
// Purpose:
// - Handles starting a Stripe Checkout session for logged-in users.
// - Supports both Individual and Business packages.
// - After checkout, users are redirected back to /dashboard/upgrade with
//   query params (?success=true / ?canceled=true) for clear feedback.
//
// Notes:
// - Any role (USER, BUSINESS_OWNER, ADMIN) can initiate a payment.
// - Stripe session metadata links the payment back to the user for record-keeping.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

// ✅ Stripe client initialization with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    // ------------------------------
    // 1. Ensure the user is logged in
    // ------------------------------
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ------------------------------
    // 2. Parse the request body
    // ------------------------------
    const { amount, currency, description } = await req.json();

    if (!amount || !currency || !description) {
      return NextResponse.json(
        { error: "Missing payment details" },
        { status: 400 }
      );
    }

    // ------------------------------
    // 3. Create a Stripe Checkout session
    // ------------------------------
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment", // one-time payment (not subscription)
      line_items: [
        {
          price_data: {
            currency, // e.g., "aud"
            product_data: { name: description }, // what the user is buying
            unit_amount: Math.round(amount * 100), // Stripe expects amounts in cents
          },
          quantity: 1,
        },
      ],
      // ✅ Updated redirect URLs:
      // - Always send users back to /dashboard/upgrade (not /staff)
      // - Query params let the frontend show toasts
      success_url: `${process.env.NEXTAUTH_URL}/dashboard/upgrade?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/upgrade?canceled=true`,

      // Metadata helps identify payment in webhook
      metadata: {
        userId: session.user.id, // which user made the purchase
        description,
      },
    });

    // ------------------------------
    // 4. Return the Stripe session URL
    // ------------------------------
    return NextResponse.json({ url: stripeSession.url });
  } catch (error) {
    console.error("Stripe payment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

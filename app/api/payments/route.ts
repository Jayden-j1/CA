import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
// Optional: could be used to log "pending payments" before redirecting to Stripe
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

//  Safe Stripe client initialization
// Uses your Secret Key from .env.local or Vercel
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    // 1️ Ensure user is logged in
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2️ Parse request body
    const { amount, currency, description } = await req.json();

    // 3️ (Optional) Restrict to business owners only
    if (session.user.role === "USER") {
      return NextResponse.json(
        { error: "Users cannot make this payment" },
        { status: 403 }
      );
    }

    // 4️ Create Stripe Checkout session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: description },
            unit_amount: Math.round(amount * 100), // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/dashboard/staff?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/staff?canceled=true`,
      metadata: {
        userId: session.user.id, // Useful in webhook to link payment → user
        description,
      },
    });

    // 5️ Send Checkout session URL to frontend
    return NextResponse.json({ url: stripeSession.url });
  } catch (error) {
    console.error("Stripe payment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

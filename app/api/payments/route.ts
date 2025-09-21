import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
// NOTE: prisma is imported but not used here. You could use it to log a
// "Pending Payment" record before sending the user to Stripe, but right now
// everything is handled by Stripe → webhook flow.
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

// No apiVersion specified → avoids type error
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    // 1️ Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2️ Parse request body
    const { amount, currency, description } = await req.json();

    // 3️ Optional: restrict this endpoint to business owners
    if (session.user.role === "USER") {
      return NextResponse.json({ error: "Users cannot make this payment" }, { status: 403 });
    }

    // 4️ Create Stripe checkout session
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
      metadata: { userId: session.user.id }, // store user for webhook
    });

    // 5️ Return session URL so frontend can redirect
    return NextResponse.json({ url: stripeSession.url });
  } catch (error) {
    console.error("Stripe payment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

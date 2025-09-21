import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

//  Initialize Stripe (no apiVersion to avoid type mismatch)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature")!; // Stripe signature header
  const rawBody = await req.text(); // Stripe requires raw text for signature check

  let event;
  try {
    // 1️ Verify webhook signature to ensure request is from Stripe
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    // 2️ Handle successful checkout
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // 3️ Record the payment in DB for auditing
      if (session.amount_total && session.metadata?.userId) {
        await prisma.payment.create({
          data: {
            userId: session.metadata.userId, // who paid
            amount: session.amount_total / 100, // convert cents → dollars
            currency: (session.currency || "aud").toUpperCase(),
            stripeId: session.id, // unique Stripe session ID
            description: session.metadata?.description || "Add Staff Member",
          },
        });
      }
    }

    // 4️ Always respond 200 so Stripe doesn’t retry endlessly
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Webhook handler error:", e);
    return new NextResponse("Server error", { status: 500 });
  }
}

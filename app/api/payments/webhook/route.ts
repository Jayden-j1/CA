import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

//  Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  // 1️ Stripe sends raw body + signature → must read raw text
  const sig = req.headers.get("stripe-signature")!;
  const rawBody = await req.text();

  let event;
  try {
    // 2️ Verify webhook signature
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    // 3️ Handle successful checkout sessions
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.amount_total && session.metadata?.userId) {
        await prisma.payment.create({
          data: {
            userId: session.metadata.userId, // Link payment to user
            amount: session.amount_total / 100, // Convert cents → dollars
            currency: (session.currency || "aud").toUpperCase(),
            stripeId: session.id,
            description:
              session.metadata?.description || "Generic Payment",
          },
        });
      }
    }

    // 4️ Always send 200 so Stripe doesn’t retry endlessly
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Webhook handler error:", e);
    return new NextResponse("Server error", { status: 500 });
  }
}

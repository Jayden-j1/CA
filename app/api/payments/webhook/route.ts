// app/api/payments/webhook/route.ts
//
// Purpose:
// - Handle Stripe webhook events (secure via signature).
// - Log payments into Prisma with clear purpose-based descriptions.
// - Specifically handle STAFF_SEAT payments differently.
//
// Key updates:
// - Removed duplicate `new Stripe(...)` declaration.
// - Use shared `stripe` instance from lib/stripe.ts.
// - Save STAFF_SEAT payments as "Staff Seat Payment" with metadata role info.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe"; // ✅ central Stripe instance
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  // 1. Extract signature + raw body
  const sig = req.headers.get("stripe-signature")!;
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    // 2. Verify webhook signature
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    // 3. Handle checkout completion
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.amount_total && session.metadata?.userId) {
        let description = "Generic Payment";

        // 🎯 Differentiate STAFF_SEAT payments
        if (session.metadata?.purpose === "STAFF_SEAT") {
          description = `Staff Seat Payment (${session.metadata.role})`;
        } else if (session.metadata?.description) {
          description = session.metadata.description;
        }

        // 4. Persist to DB
        await prisma.payment.create({
          data: {
            userId: session.metadata.userId,
            amount: session.amount_total / 100, // cents → dollars
            currency: (session.currency || "AUD").toUpperCase(),
            stripeId: session.id,
            description,
          },
        });
      }
    }

    // 5. Always ack Stripe
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[Webhook] handler error:", e);
    return new NextResponse("Server error", { status: 500 });
  }
}

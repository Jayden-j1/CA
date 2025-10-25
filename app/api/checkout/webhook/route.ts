// app/api/checkout/webhook/route.ts
//
// Purpose
// -------
// Secure Stripe webhook receiver that:
// 1) Verifies Stripe signature
// 2) Records successful payments into Prisma.Payment (idempotent)
// 3) Flips user.hasPaid = true for PACKAGE purchases (individual/business)
//
// Why this file fixes your symptom:
// - Your "Business purchase not showing in Billing" happens when we never
//   persist the payment. This webhook makes the write authoritative.
//
// Security notes:
// - Uses raw body; Stripe signature checked via STRIPE_WEBHOOK_SECRET.
// - Only reacts to "checkout.session.completed".
// - Idempotent: we skip if a payment row with this stripeId already exists.

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

// Stripe requires the raw body to verify the signature
export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: Request): Promise<Buffer> {
  const arrayBuffer = await req.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function POST(req: NextRequest) {
  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
    }

    const rawBody = await getRawBody(req);
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Webhook] Missing STRIPE_WEBHOOK_SECRET");
      return NextResponse.json({ error: "Webhook misconfigured" }, { status: 500 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("[Webhook] Signature verification failed:", err?.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (event.type !== "checkout.session.completed") {
      // We only care about completed checkout sessions for payments.
      return NextResponse.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    // Metadata set in /api/checkout/create-session
    const meta = (session.metadata || {}) as Record<string, string | undefined>;
    const purpose = (meta.purpose as "PACKAGE" | "STAFF_SEAT" | undefined) || "PACKAGE";
    const packageType = (meta.packageType as "individual" | "business" | "staff_seat" | undefined) || "individual";
    const userId = meta.userId; // present when user was signed in before checkout
    const description = meta.description || (session.mode === "payment" ? "Checkout payment" : "Payment");

    // Stripe amounts are in cents; your Payment.amount is a Float in dollars
    const amount = (session.amount_total || 0) / 100;
    const currency = (session.currency || "aud").toLowerCase();

    // Use the Checkout Session id as the unique stripeId (your model requires unique string)
    const stripeId = session.id;

    // Idempotency: skip if already recorded
    const existing = await prisma.payment.findUnique({ where: { stripeId } });
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // We require userId to attribute the payment. If Stripe metadata didn't include it,
    // we still record the payment with a safe fallback (null user won't pass your schema,
    // so we no-op in that case). This should not occur with your current flows.
    if (!userId) {
      console.warn("[Webhook] No userId in session metadata; payment not attributed.");
      return NextResponse.json({ ok: true, unattributed: true });
    }

    // Create the Payment row
    await prisma.payment.create({
      data: {
        userId,
        amount,
        currency,
        stripeId,     // UNIQUE
        description,
        purpose,      // PACKAGE | STAFF_SEAT
      },
    });

    // For plan purchases (PACKAGE), unlock access for this user
    if (purpose === "PACKAGE") {
      await prisma.user.update({
        where: { id: userId },
        data: {
          hasPaid: true,
          packageType: packageType === "business" ? "business" : "individual",
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Webhook] Unhandled error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}

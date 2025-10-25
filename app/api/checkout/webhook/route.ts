// app/api/checkout/webhook/route.ts
//
// Purpose
// -------
// 1) Verify Stripe signature and accept only checkout.session.completed.
// 2) Idempotently insert a Payment row (owner/payer).
// 3) For PACKAGE → flip payer.hasPaid = true.
// 4) For STAFF_SEAT → ACTIVATE the pre-created staff user (isActive: true) using metadata.newStaffId.
//
// Notes:
// - We DO NOT change existing behavior for PACKAGE purchases.
// - We only add the small step to activate a staff record when purpose=STAFF_SEAT.

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
      return NextResponse.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    // Metadata from create-session / staff-add
    const meta = (session.metadata || {}) as Record<string, string | undefined>;
    const purpose = (meta.purpose as "PACKAGE" | "STAFF_SEAT" | undefined) || "PACKAGE";
    const packageType = (meta.packageType as "individual" | "business" | "staff_seat" | undefined) || "individual";
    const userId = meta.userId || undefined;       // payer (owner)
    const newStaffId = meta.newStaffId || undefined; // for STAFF_SEAT activation
    const description = meta.description || (session.mode === "payment" ? "Checkout payment" : "Payment");

    const amount = (session.amount_total || 0) / 100;
    const currency = (session.currency || "aud").toLowerCase();
    const stripeId = session.id; // unique

    // Idempotency: skip if already recorded
    const existing = await prisma.payment.findUnique({ where: { stripeId } });
    if (existing) {
      // Still attempt activation in case previous run wrote payment but crashed before activation
      if (purpose === "STAFF_SEAT" && newStaffId) {
        await prisma.user.updateMany({
          where: { id: newStaffId, isActive: false },
          data: { isActive: true },
        });
      }
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (!userId) {
      console.warn("[Webhook] No userId in session metadata; payment not attributed.");
      return NextResponse.json({ ok: true, unattributed: true });
    }

    // 1) Create the Payment row (owner-scoped; Billing filters by businessId via nested user)
    await prisma.payment.create({
      data: {
        userId,
        amount,
        currency,
        stripeId,
        description,
        purpose,
      },
    });

    // 2) Post-processing based on purpose
    if (purpose === "PACKAGE") {
      // Unlock plan for payer (individual/business)
      await prisma.user.update({
        where: { id: userId },
        data: {
          hasPaid: true,
          packageType: packageType === "business" ? "business" : "individual",
        },
      });
    } else if (purpose === "STAFF_SEAT") {
      // Activate the pre-created staff (created inactive in /api/staff/add)
      if (newStaffId) {
        await prisma.user.updateMany({
          where: { id: newStaffId, isActive: false },
          data: { isActive: true },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Webhook] Unhandled error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}

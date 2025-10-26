// app/api/checkout/webhook/route.ts
//
// Purpose
// -------
// Secure Stripe webhook receiver: verify signature, record Payment (idempotent),
// unlock access for PACKAGE. NEW: For STAFF_SEAT, we encode the *beneficiary*
// (staff) in Payment.description so the Billing UI can display the staff user.
//
// Change footprint: minimal; PACKAGE flow untouched; DB shape unchanged.

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export const config = { api: { bodyParser: false } };

async function getRawBody(req: Request): Promise<Buffer> {
  const ab = await req.arrayBuffer();
  return Buffer.from(ab);
}

export async function POST(req: NextRequest) {
  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });

    const rawBody = await getRawBody(req);
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (e: any) {
      console.error("[Webhook] Signature verification failed:", e?.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const meta = (session.metadata || {}) as Record<string, string | undefined>;

    const purpose = (meta.purpose as "PACKAGE" | "STAFF_SEAT" | undefined) ?? "PACKAGE";
    const packageType =
      (meta.packageType as "individual" | "business" | "staff_seat" | undefined) ?? "individual";
    const userId = meta.userId; // payer
    const amount = (session.amount_total || 0) / 100;
    const currency = (session.currency || "aud").toLowerCase();
    const stripeId = session.id;

    // Idempotent write
    const existing = await prisma.payment.findUnique({ where: { stripeId } });
    if (existing) return NextResponse.json({ ok: true, duplicate: true });

    if (!userId) {
      console.warn("[Webhook] No userId in metadata; cannot attribute payment.");
      return NextResponse.json({ ok: true, unattributed: true });
    }

    // Build description (beneficiary for STAFF_SEAT)
    let description = meta.description || (session.mode === "payment" ? "Checkout payment" : "Payment");
    if (purpose === "STAFF_SEAT") {
      const staffEmail = meta.staffEmail;
      const staffName = meta.staffName?.trim();
      const staffRole = meta.staffRole === "ADMIN" ? "ADMIN" : "USER";
      if (staffEmail) {
        const label = staffName || staffEmail;
        description = `Staff Seat for ${label} <${staffEmail}> (${staffRole})`;
      } else {
        description = "Staff Seat";
      }
    }

    // Write Payment
    await prisma.payment.create({
      data: {
        userId,        // payer (owner/admin/individual)
        amount,
        currency,
        stripeId,      // UNIQUE
        description,   // includes beneficiary for STAFF_SEAT
        purpose,       // PACKAGE | STAFF_SEAT
      },
    });

    // Unlock for PACKAGE purchases
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

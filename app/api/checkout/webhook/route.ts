// app/api/checkout/webhook/route.ts
//
// Purpose
// -------
// Verify Stripe, upsert Payment, unlock access. For STAFF_SEAT purchases,
// we now encode the *beneficiary* (actual staff) in Payment.description,
// so Billing can render the staff member in the "User" column.
//
// What changed (surgical):
// - When purpose === "STAFF_SEAT", build a human-friendly description:
//     "Staff Seat for {NameOrEmail} <email> (ROLE)"
// - PACKAGE flow unchanged. Attribution (userId) remains the payer.
// - Still idempotent and secure.
//
// Pillars:
// - Efficiency: single pass; minimal conditionals.
// - Robustness: falls back gracefully if metadata missing.
// - Simplicity: no schema change; use existing `description` field.
// - Ease of management: predictable description format for the UI to parse.
// - Security: signature verification unchanged.

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

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
    const meta = (session.metadata || {}) as Record<string, string | undefined>;

    const purpose = (meta.purpose as "PACKAGE" | "STAFF_SEAT" | undefined) || "PACKAGE";
    const packageType = (meta.packageType as "individual" | "business" | "staff_seat" | undefined) || "individual";
    const userId = meta.userId; // payer (owner/admin/individual)
    const amount = (session.amount_total || 0) / 100;
    const currency = (session.currency || "aud").toLowerCase();
    const stripeId = session.id;

    // Skip duplicates (idempotent)
    const existing = await prisma.payment.findUnique({ where: { stripeId } });
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (!userId) {
      console.warn("[Webhook] No userId in metadata; cannot attribute payment.");
      return NextResponse.json({ ok: true, unattributed: true });
    }

    // Build a robust description:
    // - PACKAGE: keep original or sane default
    // - STAFF_SEAT: embed the staff beneficiary (if provided)
    let description: string;
    if (purpose === "STAFF_SEAT") {
      const staffEmail = meta.staffEmail;
      const staffName = meta.staffName;
      const staffRole = (meta.staffRole === "ADMIN" ? "ADMIN" : "USER");

      // Predictable string so the UI can parse safely:
      // "Staff Seat for Alice Smith <alice@org.com> (ADMIN)"
      if (staffEmail) {
        const label = staffName?.trim() || staffEmail;
        description = `Staff Seat for ${label} <${staffEmail}> (${staffRole})`;
      } else {
        description = meta.description || "Staff Seat";
      }
    } else {
      description = meta.description || (session.mode === "payment" ? "Checkout payment" : "Payment");
    }

    // Persist Payment
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

    // Unlock for PACKAGE purchases (owner/individual)
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

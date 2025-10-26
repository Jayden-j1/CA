// app/api/checkout/webhook/route.ts
//
// Purpose
// -------
// Verify Stripe signature, persist Payment (idempotent), and unlock PACKAGE.
// For STAFF_SEAT we encode the beneficiary in the description so the Billing UI
// can show the staff member instead of the payer.

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

    const raw = await getRawBody(req);
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(raw, sig, secret);
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
    const userId = meta.userId; // payer (owner/admin/individual)

    const amount = (session.amount_total || 0) / 100;
    const currency = (session.currency || "aud").toLowerCase();
    const stripeId = session.id;

    // Idempotency
    const existing = await prisma.payment.findUnique({ where: { stripeId } });
    if (existing) return NextResponse.json({ ok: true, duplicate: true });

    if (!userId) {
      console.warn("[Webhook] No userId in metadata; cannot attribute payment.");
      return NextResponse.json({ ok: true, unattributed: true });
    }

    // Build description with beneficiary for Staff Seats
    let description =
      meta.description || (session.mode === "payment" ? "Checkout payment" : "Payment");
    if (purpose === "STAFF_SEAT") {
      const staffEmail = meta.staffEmail;
      const staffName = meta.staffName?.trim();
      const staffRole = meta.staffRole === "ADMIN" ? "ADMIN" : "USER";
      description = staffEmail
        ? `Staff Seat for ${staffName || staffEmail} <${staffEmail}> (${staffRole})`
        : "Staff Seat";
    }

    // Persist payment
    await prisma.payment.create({
      data: {
        userId,        // payer
        amount,
        currency,
        stripeId,
        description,   // carries beneficiary for STAFF_SEAT
        purpose,
      },
    });

    // Unlock PACKAGE
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

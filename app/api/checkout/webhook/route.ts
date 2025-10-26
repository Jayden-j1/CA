// app/api/checkout/webhook/route.ts
//
// Purpose
// -------
// 1) Verify Stripe signature and accept only checkout.session.completed.
// 2) Idempotently insert a Payment row.
// 3) Flip user.hasPaid for PACKAGE purchases.
// 4) Activate pre-created staff for STAFF_SEAT purchases (if newStaffId is present).
//
// 🔧 Robustness patch (business purchase not showing in Billing):
// - If metadata.userId is missing (race around silent sign-in), we now fall back
//   to the payer’s email on the Stripe session (customer_email or customer_details.email),
//   look up the user in Prisma, and attribute the Payment correctly.
// - This preserves all existing behavior and fixes missed writes.
//
// Security:
// - Signature verified with STRIPE_WEBHOOK_SECRET.
// - Only reacts to checkout.session.completed.
// - Idempotent: skip if a Payment with the same stripeId already exists.

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

/**
 * Try to determine the payer userId.
 * Priority:
 *  1) metadata.userId (authoritative)
 *  2) session.customer_email / session.customer_details?.email → DB lookup
 * If neither resolves to a user in DB, return null (we’ll no-op but report OK).
 */
async function resolvePayerUserId(
  metadata: Record<string, string | undefined>,
  session: Stripe.Checkout.Session
): Promise<string | null> {
  // 1) Authoritative userId in metadata (normal path)
  if (metadata.userId) return metadata.userId;

  // 2) Fallback via email address seen on Checkout Session
  const email =
    (session.customer_email as string | null | undefined) ||
    (session.customer_details?.email as string | null | undefined) ||
    null;

  if (!email) return null;

  // Look up user by email
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    return user?.id ?? null;
  } catch {
    return null;
  }
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
      // Only handle successful checkout sessions
      return NextResponse.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    // Metadata from create-session / staff-add
    const meta = (session.metadata || {}) as Record<string, string | undefined>;
    const purpose = (meta.purpose as "PACKAGE" | "STAFF_SEAT" | undefined) || "PACKAGE";
    const packageType =
      (meta.packageType as "individual" | "business" | "staff_seat" | undefined) || "individual";
    const newStaffId = meta.newStaffId || undefined; // used for STAFF_SEAT activation
    const description = meta.description || (session.mode === "payment" ? "Checkout payment" : "Payment");

    // Amount/currency
    const amount = (session.amount_total || 0) / 100;
    const currency = (session.currency || "aud").toLowerCase();
    const stripeId = session.id; // UNIQUE

    // Idempotency: if we've already recorded this, we may still finish staff activation
    const existing = await prisma.payment.findUnique({ where: { stripeId } });
    if (existing) {
      if (purpose === "STAFF_SEAT" && newStaffId) {
        await prisma.user.updateMany({
          where: { id: newStaffId, isActive: false },
          data: { isActive: true },
        });
      }
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // 🔎 Robust `userId` resolution: metadata.userId OR fallback via payer email
    const payerUserId = await resolvePayerUserId(meta, session);
    if (!payerUserId) {
      // We don't fail the webhook; just note that we couldn’t attribute.
      // (This avoids “snowball” effects yet keeps the endpoint healthy.)
      console.warn("[Webhook] Could not resolve payer userId; payment not attributed.");
      return NextResponse.json({ ok: true, unattributed: true });
    }

    // 1) Insert Payment row (attribute to payer)
    await prisma.payment.create({
      data: {
        userId: payerUserId,
        amount,
        currency,
        stripeId,
        description,
        purpose, // PACKAGE | STAFF_SEAT
      },
    });

    // 2) Post-processing by purpose
    if (purpose === "PACKAGE") {
      // Flip hasPaid for the payer; set packageType appropriately
      await prisma.user.update({
        where: { id: payerUserId },
        data: {
          hasPaid: true,
          packageType: packageType === "business" ? "business" : "individual",
        },
      });
    } else if (purpose === "STAFF_SEAT") {
      // Activate pre-created staff (created inactive in /api/staff/add)
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

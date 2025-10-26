// app/api/payments/webhook/route.ts
//
// Purpose
// -------
// 1) Verify Stripe signature, accept only checkout.session.completed.
// 2) Idempotently insert Payment.
// 3) PACKAGE → set hasPaid=true for payer.
// 4) STAFF_SEAT → activate pre-created staff (metadata.newStaffId).
//
// Robust attribution:
// - If metadata.userId is missing, resolve payer via `customer_email` or
//   `customer_details.email`, then find the user in Prisma.
// - Set DEBUG_STRIPE_WEBHOOK=true to emit helpful logs.

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export const config = { api: { bodyParser: false } };

async function getRawBody(req: Request): Promise<Buffer> {
  const arrayBuffer = await req.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function resolvePayerUserId(
  metadata: Record<string, string | undefined>,
  session: Stripe.Checkout.Session
): Promise<{ userId: string | null; email: string | null }> {
  if (metadata.userId) return { userId: metadata.userId, email: null };

  const email =
    (session.customer_email as string | null | undefined) ||
    (session.customer_details?.email as string | null | undefined) ||
    null;

  if (!email) return { userId: null, email: null };

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    return { userId: user?.id ?? null, email };
  } catch {
    return { userId: null, email };
  }
}

export async function POST(req: NextRequest) {
  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });

    const rawBody = await getRawBody(req);
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[Webhook] Missing STRIPE_WEBHOOK_SECRET");
      return NextResponse.json({ error: "Webhook misconfigured" }, { status: 500 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
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
    const packageType =
      (meta.packageType as "individual" | "business" | "staff_seat" | undefined) || "individual";
    const newStaffId = meta.newStaffId || undefined;
    const description = meta.description || "Checkout payment";

    const amount = (session.amount_total || 0) / 100;
    const currency = (session.currency || "aud").toLowerCase();
    const stripeId = session.id;

    // Idempotent: skip if already saved
    const existing = await prisma.payment.findUnique({ where: { stripeId } });
    if (existing) {
      // Ensure staff activation even if duplicate (rare retries)
      if (purpose === "STAFF_SEAT" && newStaffId) {
        await prisma.user.updateMany({
          where: { id: newStaffId, isActive: false },
          data: { isActive: true },
        });
      }
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // Resolve payer (owner) for attribution and Billing scope
    const { userId: payerUserId, email: fallbackEmail } = await resolvePayerUserId(meta, session);

    if (process.env.DEBUG_STRIPE_WEBHOOK === "true") {
      console.log("[Webhook][Debug] purpose:", purpose);
      console.log("[Webhook][Debug] meta.userId:", meta.userId || "(none)");
      console.log("[Webhook][Debug] fallback email:", fallbackEmail || "(none)");
      console.log("[Webhook][Debug] resolved userId:", payerUserId || "(none)");
    }

    if (!payerUserId) {
      console.warn("[Webhook] Could not resolve payer userId; payment not attributed.");
      return NextResponse.json({ ok: true, unattributed: true });
    }

    // 1) Record the payment
    await prisma.payment.create({
      data: {
        userId: payerUserId,
        amount,
        currency,
        stripeId,
        description,
        purpose,
      },
    });

    // 2) Post-processing based on purpose
    if (purpose === "PACKAGE") {
      await prisma.user.update({
        where: { id: payerUserId },
        data: {
          hasPaid: true,
          packageType: packageType === "business" ? "business" : "individual",
        },
      });
    } else if (purpose === "STAFF_SEAT" && newStaffId) {
      // Activate the pre-created staff so they appear in /dashboard/staff
      await prisma.user.updateMany({
        where: { id: newStaffId, isActive: false },
        data: { isActive: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Webhook] Unhandled error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}

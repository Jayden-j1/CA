// app/api/checkout/webhook/route.ts
//
// Purpose
// -------
// 1) Verify Stripe signature and accept only checkout.session.completed.
// 2) Idempotently insert a Payment row.
// 3) Flip user.hasPaid for PACKAGE purchases.
// 4) Activate pre-created staff for STAFF_SEAT (if newStaffId is present).
//
// 🔧 Robustness:
// - If metadata.userId is missing, resolve payer via session.customer_email
//   or session.customer_details.email, then look up user in Prisma.
//
// 🔍 Optional debugging (set DEBUG_STRIPE_WEBHOOK=true):
// - Logs resolved email/userId and purpose to help confirm attribution end-to-end.

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
    const packageType =
      (meta.packageType as "individual" | "business" | "staff_seat" | undefined) || "individual";
    const newStaffId = meta.newStaffId || undefined;
    const description = meta.description || (session.mode === "payment" ? "Checkout payment" : "Payment");

    const amount = (session.amount_total || 0) / 100;
    const currency = (session.currency || "aud").toLowerCase();
    const stripeId = session.id;

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

    // Resolve payer
    const { userId: payerUserId, email: fallbackEmail } = await resolvePayerUserId(meta, session);

    if (process.env.DEBUG_STRIPE_WEBHOOK === "true") {
      console.log("[Webhook][Debug] purpose:", purpose);
      console.log("[Webhook][Debug] meta.userId:", meta.userId);
      console.log("[Webhook][Debug] fallback email:", fallbackEmail || "(none)");
      console.log("[Webhook][Debug] resolved userId:", payerUserId || "(none)");
    }

    if (!payerUserId) {
      console.warn("[Webhook] Could not resolve payer userId; payment not attributed.");
      return NextResponse.json({ ok: true, unattributed: true });
    }

    // Write payment
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

    // Post-processing
    if (purpose === "PACKAGE") {
      await prisma.user.update({
        where: { id: payerUserId },
        data: {
          hasPaid: true,
          packageType: packageType === "business" ? "business" : "individual",
        },
      });
    } else if (purpose === "STAFF_SEAT" && newStaffId) {
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

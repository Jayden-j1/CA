// app/api/payments/webhook/route.ts
//
// Purpose
// -------
// Authoritative Stripe webhook receiver for ALL checkout flows.
// It verifies the signature, parses metadata, writes a Payment row (idempotent),
// and flips user.hasPaid for PACKAGE purchases.
// This is the endpoint your logs show being invoked ("/api/payments/webhook"),
// so persisting the Payment here resolves "Billing shows no purchase".
//
// Security
// --------
// - Uses the raw request body for signature verification.
// - Requires STRIPE_WEBHOOK_SECRET.
// - Inserts are idempotent via unique Payment.stripeId (Checkout Session id).
//
// Notes
// -----
// - `purpose` metadata: "PACKAGE" or "STAFF_SEAT"
// - `packageType`: "individual" | "business" | "staff_seat" (for display/unlocking)
// - `userId` metadata: the payer's user id (owner for staff seats)
// - Amount is stored in dollars (float) from Stripe cents.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

// Stripe needs the raw body for signature verification.
// (Next.js App Router supports reading the raw ArrayBuffer from the request.)
export const config = {
  api: { bodyParser: false },
};

async function rawBody(req: Request): Promise<Buffer> {
  const ab = await req.arrayBuffer();
  return Buffer.from(ab);
}

export async function POST(req: NextRequest) {
  try {
    // 1) Verify signature
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
    }
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[Webhook] Missing STRIPE_WEBHOOK_SECRET");
      return NextResponse.json({ error: "Webhook misconfigured" }, { status: 500 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(await rawBody(req), sig, secret);
    } catch (err: any) {
      console.error("[Webhook] Invalid signature:", err?.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // We only care about completed checkout sessions
    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ received: true });
    }

    // 2) Extract session + metadata
    const session = event.data.object as Stripe.Checkout.Session;

    const meta = (session.metadata || {}) as Record<string, string | undefined>;
    const purpose = (meta.purpose as "PACKAGE" | "STAFF_SEAT" | undefined) || "PACKAGE";
    const packageType =
      (meta.packageType as "individual" | "business" | "staff_seat" | undefined) || "individual";
    const userId = meta.userId; // set by create-session routes
    const description = meta.description || "Checkout payment";

    const amount = (session.amount_total || 0) / 100; // cents -> dollars
    const currency = (session.currency || "aud").toLowerCase();
    const stripeId = session.id; // unique across retries → safe for idempotency

    // Optional verbose debugging (controlled by env)
    if (process.env.DEBUG_STRIPE_WEBHOOK === "true") {
      console.log("[Webhook][Debug] purpose:", purpose);
      console.log("[Webhook][Debug] meta.userId:", userId || "(none)");
      console.log("[Webhook][Debug] fallback email:", "(none)"); // kept for parity with earlier logs
      console.log("[Webhook][Debug] resolved userId:", userId || "(none)");
    }

    // 3) Require a userId to attribute the payment
    if (!userId) {
      console.warn("[Webhook] checkout.session.completed without userId metadata – skipping persist");
      return NextResponse.json({ ok: true, unattributed: true });
    }

    // 4) Idempotent write: if we already saved this session, do nothing.
    const exists = await prisma.payment.findUnique({ where: { stripeId } });
    if (exists) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // 5) Persist Payment row
    await prisma.payment.create({
      data: {
        userId,
        amount,
        currency,
        stripeId,   // UNIQUE in schema
        description,
        purpose,    // PACKAGE | STAFF_SEAT
      },
    });

    // 6) Unlock access for PACKAGE purchases (individual or business)
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

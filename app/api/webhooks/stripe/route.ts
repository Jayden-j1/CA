// app/api/webhooks/stripe/route.ts
//
// Purpose (unchanged):
// - Verify Stripe event → persist a Payment row (idempotently).
//
// What changed:
// - We now accept `metadata.userId` (preferred) **or** `metadata.staffUserId` (fallback).
// - If `purpose` is missing but `staffUserId` is present, we default to "STAFF_SEAT".
//   This makes the handler robust to any older checkout sessions that didn't send purpose.

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[Stripe Webhook] Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    const raw = await req.text();
    event = await stripe.webhooks.constructEventAsync(raw, sig, webhookSecret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err?.message || err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
    }
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("[Stripe Webhook] Handler error:", err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid") return;

  // 1) Metadata
  const md = (session.metadata || {}) as Record<string, string | undefined>;

  // Prefer `userId`; fall back to legacy `staffUserId` if present.
  let userId = md.userId || md.staffUserId;

  // Purpose: from metadata if present; otherwise infer STAFF_SEAT if staffUserId exists.
  const purposeRaw = (md.purpose || "").toUpperCase();
  let purpose: "PACKAGE" | "STAFF_SEAT";
  if (purposeRaw === "PACKAGE" || purposeRaw === "STAFF_SEAT") {
    purpose = purposeRaw as "PACKAGE" | "STAFF_SEAT";
  } else {
    purpose = md.staffUserId ? "STAFF_SEAT" : "PACKAGE";
  }

  // Convert cents → dollars; store lowercase currency to match your UI usage.
  const amountCents = session.amount_total || 0;
  const amount = Math.round((amountCents / 100) * 100) / 100;
  const currency = (session.currency || "aud").toLowerCase();
  let description = md.description || "";

  // 2) If userId still not determined, fall back to email matching
  if (!userId) {
    const email =
      session.customer_details?.email ||
      (typeof session.customer_email === "string" ? session.customer_email : undefined);
    if (email) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (user) userId = user.id;
    }
  }

  if (!userId) {
    console.error("[Stripe Webhook] Could not determine userId for session:", session.id);
    return;
  }

  // 3) Enrich description from first line item if still empty
  if (!description) {
    try {
      const full = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items.data.price.product"],
      });
      const first = full.line_items?.data?.[0];
      const product = first?.price?.product as Stripe.Product | null;
      description =
        product?.name || first?.description || (purpose === "STAFF_SEAT" ? "Staff Seat" : "Package");
    } catch {
      description = purpose === "STAFF_SEAT" ? "Staff Seat" : "Package";
    }
  }

  // 4) Idempotency: stripeId is unique
  const exists = await prisma.payment.findUnique({
    where: { stripeId: session.id },
    select: { id: true },
  });
  if (exists) return;

  // 5) Create Payment row → this unlocks access for the target userId
  await prisma.payment.create({
    data: {
      stripeId: session.id,
      userId,
      amount,
      currency,
      description,
      purpose,
    },
  });
}

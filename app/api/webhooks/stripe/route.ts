// app/api/webhooks/stripe/route.ts
//
// Purpose
// -------
// Securely receive Stripe events and persist successful payments into your DB.
// This is the missing link that flips `hasPaid` to true after checkout, which:
//   • unlocks Map/Course
//   • hides "Upgrade"
//   • shows "Billing" for paid individuals (and for owners/admin)
//
// Events handled
// --------------
// - checkout.session.completed  (mode=payment, payment_status='paid')
//
// Security
// --------
// - We verify Stripe's signature using STRIPE_WEBHOOK_SECRET.
// - We never trust client-provided amounts; we read amount_total from Stripe.
// - We find the user by metadata.userId (preferred) or fallback to email.
//
// Data decisions
// --------------
// - We store amount in **dollars** (converted from Stripe cents) to match your UI,
//   which displays `${payment.amount}` directly.
// - `purpose` comes from metadata: "PACKAGE" or "STAFF_SEAT".
// - `description` uses metadata.description, or falls back to the line item/product name.
// - `stripeId` stores `session.id` for strong idempotency and audit trails.
//
// Idempotency
// -----------
// - Stripe guarantees at-least-once delivery; we may receive duplicates.
// - We now rely on `stripeId = session.id` for idempotency. If we already have a row
//   with the same stripeId, we skip creating another.
//
// Environment
// -----------
// - STRIPE_WEBHOOK_SECRET (from your Stripe Dashboard / CLI)
// - We reuse your configured Stripe client from lib/stripe.

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
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      default:
        // Not an error: ignore events we don't care about
        break;
    }

    // Always 200 OK if we processed (or intentionally ignored) the event.
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("[Stripe Webhook] Handler error:", err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}

/**
 * Handle a completed Checkout Session:
 * - Only mode="payment" and payment_status="paid" are treated as purchases.
 * - Determine user, amount, purpose, description.
 * - Persist a Payment record if one doesn't already exist (idempotent via stripeId).
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid") return;

  // ── 1) Extract metadata
  const md = (session.metadata || {}) as Record<string, string | undefined>;
  const purposeRaw = (md.purpose || "").toUpperCase();
  const purpose: "PACKAGE" | "STAFF_SEAT" =
    purposeRaw === "STAFF_SEAT" ? "STAFF_SEAT" : "PACKAGE";

  let description = md.description || "";

  // Convert cents → dollars for display
  const amountCents = session.amount_total || 0;
  const amountDollars = Math.round((amountCents / 100) * 100) / 100;
  const currency = (session.currency || "aud").toLowerCase();

  // Prefer userId from metadata
  let userId = md.userId;

  // Fallback: resolve via email
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

  // ── 2) Enrich description from line items if needed
  if (!description) {
    try {
      const full = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items.data.price.product"],
      });
      const first = full.line_items?.data?.[0];
      const prod = (first?.price?.product as Stripe.Product | null) || null;
      description =
        prod?.name ||
        first?.description ||
        (purpose === "STAFF_SEAT" ? "Staff Seat" : "Package");
    } catch {
      description = purpose === "STAFF_SEAT" ? "Staff Seat" : "Package";
    }
  }

  // ── 3) True idempotency guard using stripeId
  const existing = await prisma.payment.findUnique({
    where: { stripeId: session.id },
    select: { id: true },
  });
  if (existing) {
    // Already processed → skip
    return;
  }

  // ── 4) Persist Payment record
  await prisma.payment.create({
    data: {
      stripeId: session.id, // ✅ required and unique
      userId,
      amount: amountDollars,
      currency,
      description,
      purpose,
    },
  });

  // ✅ Done. NextAuth jwt() will pick this up and set session.user.hasPaid = true
}

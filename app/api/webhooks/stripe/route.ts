// app/api/webhooks/stripe/route.ts
//
// Purpose:
// - Verify Stripe event → persist a Payment row (idempotently).
// - **NEW**: When the purchase is a PACKAGE (individual/business),
//   also flip `User.hasPaid = true` and store `User.packageType`.
//   This is the single source of truth your UI reads via NextAuth `session()`.
//
// Why this change?
// - Your UI/navigation/billing guards depend on `session.user.hasPaid`,
//   and `lib/auth.ts` mirrors the DB on each request.
// - If we never set `User.hasPaid = true`, the user looks unpaid forever,
//   even though the Payment row exists.
//
// Security/Robustness:
// - We determine `purpose` from metadata (or infer), and only flip `hasPaid`
//   for PACKAGE purchases (not STAFF_SEAT).
// - We do all DB writes inside a transaction with idempotency (stripeId unique).
//
// Pillars:
// - Efficiency: single transaction per webhook event.
// - Robustness: idempotent creation + safe updates.
// - Simplicity: centralize paid-state flip here.
// - Ease of mgmt: no need to compute paid state elsewhere.
// - Security: never trust client input; use webhook -> server truth.

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

  // 1) Pull normalized metadata
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

  // Optional package type for PACKAGE purchases: "individual" | "business" | "staff_seat"
  // (We only store this on User for PACKAGE.)
  const packageType = md.packageType && ["individual", "business", "staff_seat"].includes(md.packageType)
    ? md.packageType
    : undefined;

  // Convert cents → dollars; store lowercase currency to match your UI usage.
  const amountCents = session.amount_total || 0;
  const amount = Math.round((amountCents / 100) * 100) / 100;
  const currency = (session.currency || "aud").toLowerCase();
  let description = md.description || "";

  // 2) If userId not provided, fall back to email matching
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
    return; // Cannot continue safely
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

  // 4) Idempotency + state flip in one transaction
  await prisma.$transaction(async (tx) => {
    // (a) Idempotency: if Payment with this stripeId already exists, stop early
    const existing = await tx.payment.findUnique({
      where: { stripeId: session.id },
      select: { id: true },
    });
    if (existing) return;

    // (b) Create the Payment row
    await tx.payment.create({
      data: {
        stripeId: session.id,
        userId,
        amount,
        currency,
        description,
        purpose,
      },
    });

    // (c) Flip `user.hasPaid = true` for PACKAGE purchases (not for STAFF_SEAT).
    //     Also set `packageType` when provided (individual/business).
    if (purpose === "PACKAGE") {
      await tx.user.update({
        where: { id: userId },
        data: {
          hasPaid: true,
          ...(packageType && packageType !== "staff_seat" ? { packageType } : {}),
        },
      });
    }
  });
}

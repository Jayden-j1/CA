// app/api/webhooks/stripe/route.ts
//
// Purpose:
// - Verify Stripe event → persist a Payment row (idempotently) and
//   update the user’s billing flags when appropriate.
//
// Why this change?
// - Previously we created the Payment but *did not* update `User.hasPaid` or
//   `User.packageType`, so your app never unlocked access post-purchase.
// - This version updates the user for PACKAGE purchases in the same transaction,
//   while keeping STAFF_SEAT behavior isolated.
//
// Pillars
// -------
// ✅ Efficiency  – single transaction; no redundant reads
// ✅ Robustness  – idempotent upsert on stripeId; safe metadata parsing
// ✅ Simplicity  – small, focused handler
// ✅ Ease of mgmt – clear comments; minimal surface area
// ✅ Security    – signature verification, no client-trusted data

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
    // ⚠️ IMPORTANT: we must read the raw text body for Stripe signature verification
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
  // Only process immediate payments (not subscriptions, invoices, etc.)
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid") return;

  // 1) Extract and normalize metadata
  const md = (session.metadata || {}) as Record<string, string | undefined>;

  // Prefer `userId`; fall back to legacy `staffUserId` if present.
  let userId = md.userId || md.staffUserId;

  // Purpose: explicit if provided, else infer from `staffUserId` presence.
  const purposeRaw = (md.purpose || "").toUpperCase();
  const purpose: "PACKAGE" | "STAFF_SEAT" =
    purposeRaw === "PACKAGE" || purposeRaw === "STAFF_SEAT"
      ? (purposeRaw as "PACKAGE" | "STAFF_SEAT")
      : md.staffUserId
      ? "STAFF_SEAT"
      : "PACKAGE";

  // Package type normalization (only meaningful for PACKAGE purchases)
  const pkgRaw = (md.packageType || "").toLowerCase();
  const normalizedPackage: "individual" | "business" | "staff_seat" =
    pkgRaw === "business" || pkgRaw === "staff_seat" ? (pkgRaw as any) : "individual";

  // Monetary info
  const amountCents = session.amount_total || 0;
  const amount = Math.round((amountCents / 100) * 100) / 100; // two decimals
  const currency = (session.currency || "aud").toLowerCase();

  // 2) If userId isn’t in metadata, try to match by email
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
    // We can’t attach this payment. Log & exit quietly (Stripe will show the receipt).
    console.error("[Stripe Webhook] Could not determine userId for session:", session.id);
    return;
  }

  // 3) Try to enrich a human-friendly description from metadata or line item
  let description = md.description || "";
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

  // 4) Idempotently write the Payment and update the User when appropriate.
  //    - The Payment is keyed by `stripeId` (session id).
  //    - For PACKAGE purchases, we flip `hasPaid` and set `packageType`.
  await prisma.$transaction([
    prisma.payment.upsert({
      where: { stripeId: session.id },
      update: {}, // nothing to change if it already exists
      create: {
        stripeId: session.id,
        userId,
        amount,
        currency,
        description,
        purpose,
      },
    }),

    // Only update the user for actual package purchases. Staff seats shouldn’t
    // mark the purchaser as “paid” unless your business logic demands it.
    ...(purpose === "PACKAGE"
      ? [
          prisma.user.update({
            where: { id: userId },
            data: {
              hasPaid: true,
              packageType: normalizedPackage, // "individual" | "business" | "staff_seat"
            },
          }),
        ]
      : []),
  ]);
}

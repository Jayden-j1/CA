// app/api/webhooks/stripe/route.ts
//
// Purpose
// -------
// - Verify Stripe event → persist a Payment row (idempotently).
// - Flip `User.hasPaid = true` for PACKAGE purchases.
// - Persist `User.packageType` when provided ("individual" | "business").
// - ✅ NEW: If the paying user is a BUSINESS_OWNER, **cascade** paid access to ALL current staff:
//     update every user whose `businessId` equals the owner’s `id` → `hasPaid = true`.
//   This keeps staff UIs instantly unlocked without waiting on any probes.
//
// Why here?
// ---------
// - This is the single server-verified source of truth for payment completion.
// - Centralized flipping here avoids scattered logic and race conditions.
// - The cascade is transactionally safe and idempotent (stripeId is unique).
//
// Security & Robustness
// ---------------------
// - Uses Stripe signature verification.
// - Never trusts client input (prices, purpose) — relies on metadata + inference.
// - Handles idempotency: if a Payment row for this Stripe session already exists, we skip all writes.
// - Only cascades for PACKAGE purchases (never STAFF_SEAT).
//
// Pillars
// -------
// ✅ Efficiency   – single transaction per event; targeted bulk update for staff
// ✅ Robustness   – idempotent & safe; fallback userId resolution by email
// ✅ Simplicity   – linear control flow; explicit, documented steps
// ✅ Ease of mgmt – one place to maintain access flip rules
// ✅ Security     – signed webhook; no client-trusted data

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
    // Read raw body and verify signature
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

    // Acknowledge receipt to Stripe
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("[Stripe Webhook] Handler error:", err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}

/**
 * Handle a successful Checkout session.
 * - Idempotently creates a Payment row.
 * - If purpose === PACKAGE → set user.hasPaid = true & keep packageType if provided.
 * - ✅ NEW: If the payer is a BUSINESS_OWNER and purpose === PACKAGE → cascade hasPaid = true to all staff.
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  // We only care about fully-paid "payment" sessions
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid") return;

  // 1) Normalize metadata
  // ---------------------
  const md = (session.metadata || {}) as Record<string, string | undefined>;

  // Prefer `userId` (sent when logged-in), fall back to a legacy `staffUserId` if present.
  let userId = md.userId || md.staffUserId;

  // Purpose comes from metadata; if missing, infer STAFF_SEAT when staffUserId exists, else PACKAGE.
  const purposeRaw = (md.purpose || "").toUpperCase();
  let purpose: "PACKAGE" | "STAFF_SEAT";
  if (purposeRaw === "PACKAGE" || purposeRaw === "STAFF_SEAT") {
    purpose = purposeRaw as "PACKAGE" | "STAFF_SEAT";
  } else {
    purpose = md.staffUserId ? "STAFF_SEAT" : "PACKAGE";
  }

  // Optional package type for PACKAGE purchases (we store it only for PACKAGE)
  const packageType =
    md.packageType && ["individual", "business", "staff_seat"].includes(md.packageType)
      ? md.packageType
      : undefined;

  // Convert cents → dollars (two decimals) and unify currency lowercasing
  const amountCents = session.amount_total || 0;
  const amount = Math.round((amountCents / 100) * 100) / 100;
  const currency = (session.currency || "aud").toLowerCase();

  // Description defaults later from product name if not present
  let description = md.description || "";

  // 2) If userId still not present, fall back to email lookup (last resort)
  // -----------------------------------------------------------------------
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

  // If we still can’t determine userId, we can’t safely write — abort quietly (Stripe already knows it's paid).
  if (!userId) {
    console.error("[Stripe Webhook] Could not determine userId for session:", session.id);
    return;
  }

  // 3) If description is missing, enrich from first line item/product
  // -----------------------------------------------------------------
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

  // 4) Idempotent write + state flips (and ✅ cascade for owners) in a single transaction
  // -------------------------------------------------------------------------------------
  await prisma.$transaction(async (tx) => {
    // (a) Idempotency: if a Payment with this stripeId already exists, stop early
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

    // (c) Flip paid state when purpose === PACKAGE (never for STAFF_SEAT)
    if (purpose === "PACKAGE") {
      // Update payer's hasPaid flag and optional packageType (ignore "staff_seat" here).
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          hasPaid: true,
          ...(packageType && packageType !== "staff_seat" ? { packageType } : {}),
        },
        select: {
          id: true,
          role: true,
        },
      });

      // (d) ✅ NEW: If a BUSINESS_OWNER paid, **cascade** hasPaid = true to ALL existing staff
      //     Staff are any users whose `businessId` equals the owner’s `id`.
      //     We purposely do not alter roles or other fields — just grant access.
      if (updatedUser.role === "BUSINESS_OWNER") {
        await tx.user.updateMany({
          where: { businessId: updatedUser.id },
          data: { hasPaid: true },
        });
        // Note: This is a mirror for faster UI; the access check endpoint ALSO grants
        //       inherited access even if staff.hasPaid were false. Keeping both makes
        //       the experience snappy and resilient.
      }
    }
  });
}

// app/api/checkout/webhook/route.ts
//
// Purpose
// -------
// Securely receive Stripe webhook events and write authoritative payment records.
// We only handle `checkout.session.completed` here to keep scope tight and safe.
//
// What this does
// --------------
// 1) Verifies Stripe signature using STRIPE_WEBHOOK_SECRET
// 2) Extracts metadata we set during checkout:
//      • purpose      → "PACKAGE" | "STAFF_SEAT"
//      • packageType  → "individual" | "business" | "staff_seat" (for PACKAGE, we use this to set user.packageType)
//      • description  → e.g. "Business Package"
//      • userId       → payer user id (so we can attribute Payment)
// 3) Idempotency: if a Payment already exists for this `stripeId` (session.id), do nothing.
// 4) Writes a Payment row, and for PACKAGE purchases marks the user as paid.
//
// Notes
// -----
// • No schema changes required.
// • This route intentionally avoids touching staff creation logic. It only
//   records the seat payment (`purpose = STAFF_SEAT`) so Billing shows it.
// • If you later add more event types, keep them guarded and idempotent.
//
// Environment
// -----------
// - STRIPE_SECRET_KEY        (already in use)
// - STRIPE_WEBHOOK_SECRET    (this is new; create it in your Stripe Dashboard)
// - NEXT_PUBLIC_APP_URL      (unchanged)
//
// Next.js runtime
// ---------------
// - Use Node.js runtime (Stripe requires raw body to verify signatures).
// - Read the raw request body via req.text() and pass to `constructEvent`.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export const runtime = "nodejs";         // Required for raw body access
export const dynamic = "force-dynamic";  // Webhooks must not be statically optimized

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16" as any,
});

function safeUpper<T extends string>(v: unknown, fallback: T): T {
  return (typeof v === "string" ? (v.toUpperCase() as T) : fallback) || fallback;
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[Webhook] Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Misconfigured webhook secret" }, { status: 500 });
  }

  // 1) Read raw body and signature header
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("[Webhook] Signature verification failed:", err?.message || err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // 2) Handle event types we care about
  if (event.type !== "checkout.session.completed") {
    // No-op for other events (safe to return 200)
    return NextResponse.json({ received: true, ignored: event.type }, { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Defensive guards around optional fields
  const stripeId = session.id; // unique per checkout session
  const amountTotal = typeof session.amount_total === "number" ? session.amount_total : 0;
  const currency = (session.currency || "aud").toUpperCase();
  const meta = session.metadata || {};

  const purpose = safeUpper<"PACKAGE" | "STAFF_SEAT">(meta.purpose, "PACKAGE"); // default to PACKAGE
  const description = typeof meta.description === "string" ? meta.description : (session.mode || "Payment");
  const userId = typeof meta.userId === "string" ? meta.userId : null;

  // For PACKAGE purchases, we may also get packageType
  const packageType = typeof meta.packageType === "string" ? meta.packageType : null;

  // 3) Idempotency: bail if we've already recorded this session
  const existing = await prisma.payment.findUnique({ where: { stripeId } }).catch(() => null);
  if (existing) {
    return NextResponse.json({ ok: true, idempotent: true }, { status: 200 });
  }

  // 4) Insert Payment row
  //    Note: amount is stored in dollars (not cents) in your schema.
  try {
    if (!userId) {
      // We expect userId metadata. If missing, still create a Payment without a user?
      // To avoid referential issues, we require userId here. If you want to allow
      // guest checkouts later, you can relax this (but your schema requires userId).
      console.error("[Webhook] Missing userId metadata; cannot attribute payment.");
      return NextResponse.json({ error: "Missing userId metadata" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          userId,
          amount: amountTotal > 0 ? amountTotal / 100 : 0,
          currency,
          stripeId,
          description,
          purpose, // Prisma enum: "PACKAGE" | "STAFF_SEAT"
        },
      });

      // If this was a plan/package purchase, mark the user as paid
      if (purpose === "PACKAGE") {
        await tx.user.update({
          where: { id: userId },
          data: {
            hasPaid: true,
            ...(packageType ? { packageType } : {}),
          },
        });
      }
      // STAFF_SEAT: no user flags to set here (seat is for a staff account purchase).
      // The existence of the Payment row is what the Billing UI needs to show the line item.
    });
  } catch (err) {
    console.error("[Webhook] Failed to write payment:", err);
    // Return 200 so Stripe doesn’t hammer retries forever if this was a logic error.
    // If you want automatic retries, return 500 instead — but ensure your handler is idempotent (it is).
    return NextResponse.json({ error: "Payment write failed" }, { status: 200 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

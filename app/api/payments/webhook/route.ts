// app/api/payments/webhook/route.ts
//
// Purpose:
// - Handle Stripe webhook events (signed + verified).
// - Save completed payments into Prisma with proper purpose (PACKAGE vs STAFF_SEAT).
// - Log metadata for debugging (staff seat IDs in dev/CLI tests).
//
// Updates in this version:
// - Uses `metadata.description` set by the checkout creator for clear statements.
// - Writes purpose directly from `metadata.purpose` ("PACKAGE" or "STAFF_SEAT").
// - Defensive create to handle Stripe retrying the same event.
// - Keeps a light, audit-friendly log (no secrets).
//
// Notes:
// - Stripe always retries webhooks if you don’t return 2xx → always ACK.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  // 1) Stripe requires the raw body for signature verification
  const sig = req.headers.get("stripe-signature")!;
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("[Webhook] Signature verification failed:", err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    // 2) We care about completed checkout sessions
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const md = session.metadata || {};

      // Friendly, non-sensitive log for audit/debug
      console.log("[Webhook] checkout.session.completed", {
        amount_total: session.amount_total,
        currency: session.currency,
        userId: md.userId,
        purpose: md.purpose,
        packageType: md.packageType,
      });

      // 3) Validate required pieces
      if (!session.amount_total || !md.userId) {
        console.warn("[Webhook] Missing amount_total or metadata.userId; skipping save.");
        return NextResponse.json({ received: true });
      }

      // 4) Compute purpose + description
      const purpose = md.purpose === "STAFF_SEAT" ? "STAFF_SEAT" : "PACKAGE";
      const description = md.description || (purpose === "STAFF_SEAT"
        ? "Staff Seat Payment"
        : "Package Purchase");

      // 5) Persist payment in DB
      //    If you set `stripeId` unique, this defends against duplicate inserts on Stripe retries.
      try {
        await prisma.payment.create({
          data: {
            userId: md.userId,                                 // staff user or package owner
            amount: session.amount_total / 100,                // cents → dollars
            currency: (session.currency || "AUD").toUpperCase(),
            stripeId: session.id,                              // for idempotency/trace
            description,                                       // friendly label
            purpose,                                           // "PACKAGE" | "STAFF_SEAT"
          },
        });
        console.log(`[Webhook] Saved payment: ${description} for user ${md.userId}`);
      } catch (dbErr: any) {
        // Ignore duplicates so the webhook stays idempotent-friendly
        if (dbErr?.code === "P2002") {
          console.log("[Webhook] Duplicate stripeId, skipping insert.");
        } else {
          throw dbErr;
        }
      }
    }

    // 6) Always ACK (avoids retry storms)
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[Webhook] Handler error:", e);
    return new NextResponse("Server error", { status: 500 });
  }
}

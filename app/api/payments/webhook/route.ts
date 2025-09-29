// app/api/payments/webhook/route.ts
//
// Purpose:
// - Handle Stripe webhooks safely (idempotent).
// - Save payments as PACKAGE or STAFF_SEAT with correct userId.
// - Attach metadata so staff-seat payments unlock staff accounts directly.
//
// Improvements in this version:
// - Defensive duplicate handling (stripeId unique).
// - Uses metadata.userId (MUST be passed from checkout).
// - Always ACK Stripe (prevents retry storms).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature")!;
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    // ✅ Verify event authenticity
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
    // Only care about checkout completion
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const md = session.metadata || {};

      console.log("[Webhook] Checkout completed", {
        amount_total: session.amount_total,
        currency: session.currency,
        userId: md.userId,
        purpose: md.purpose,
        packageType: md.packageType,
      });

      if (!session.amount_total || !md.userId) {
        console.warn("[Webhook] Missing amount_total or metadata.userId, skipping.");
        return NextResponse.json({ received: true });
      }

      const purpose = md.purpose === "STAFF_SEAT" ? "STAFF_SEAT" : "PACKAGE";
      const description =
        md.description || (purpose === "STAFF_SEAT" ? "Staff Seat Payment" : "Package Purchase");

      try {
        // ✅ Insert payment
        await prisma.payment.create({
          data: {
            userId: md.userId,
            amount: session.amount_total / 100, // cents → dollars
            currency: (session.currency || "AUD").toUpperCase(),
            stripeId: session.id, // unique for idempotency
            description,
            purpose,
          },
        });
        console.log(`[Webhook] Saved ${purpose} payment for user ${md.userId}`);
      } catch (dbErr: any) {
        // Handle duplicates gracefully
        if (dbErr?.code === "P2002") {
          console.log("[Webhook] Duplicate stripeId, skipping.");
        } else {
          throw dbErr;
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Webhook] Handler error:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}

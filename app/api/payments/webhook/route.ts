// app/api/payments/webhook/route.ts
//
// Purpose:
// - Handle incoming Stripe webhook events (signed + verified).
// - Save completed payments into Prisma with proper purpose (PACKAGE vs STAFF_SEAT).
// - Log metadata for debugging (so you can see staff seat IDs in dev/CLI tests).
//
// Notes:
// - Stripe always retries webhooks if you don’t return 2xx → always ACK with JSON.
// - Staff-seat metadata (userId, businessId, payerId) is logged for easier CLI testing.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  // 1. Grab signature header + raw body (needed for verification)
  const sig = req.headers.get("stripe-signature")!;
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    // 2. Verify authenticity of the webhook (protects against spoofed requests)
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
    // 3. Only act on successful checkout sessions
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // ✅ Log full metadata for debugging (staff seat, business, payer info)
      console.log("[Webhook] Checkout completed with metadata:", session.metadata);

      // Ensure required info is present
      if (session.amount_total && session.metadata?.userId) {
        // Default values
        let description = "Generic Payment";
        let purpose: "PACKAGE" | "STAFF_SEAT" = "PACKAGE";

        // Differentiate package vs staff seat
        if (session.metadata?.purpose === "STAFF_SEAT") {
          purpose = "STAFF_SEAT";
          description = `Staff Seat Payment for ${session.metadata.staffEmail || "staff member"}`;
        } else if (session.metadata?.description) {
          description = session.metadata.description;
          purpose = "PACKAGE";
        }

        // 4. Save payment record into DB
        await prisma.payment.create({
          data: {
            userId: session.metadata.userId, // The user (staff or package owner)
            amount: session.amount_total / 100, // cents → dollars
            currency: (session.currency || "AUD").toUpperCase(),
            stripeId: session.id,
            description,
            purpose,
          },
        });

        console.log(`[Webhook] Saved payment: ${description} for user ${session.metadata.userId}`);
      }
    }

    // 5. Always ACK Stripe (otherwise they retry forever)
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[Webhook] Handler error:", e);
    return new NextResponse("Server error", { status: 500 });
  }
}

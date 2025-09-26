// app/api/payments/webhook/route.ts
//
// Purpose:
// - Handle Stripe webhook events (secure via signature).
// - Save payments into Prisma with a clear `purpose` field (enum).
// - Differentiate between PACKAGE purchases vs STAFF_SEAT purchases.
//
// Key updates:
// - Use shared Stripe instance from lib/stripe.ts (avoid duplicate clients).
// - Persist `purpose` enum into DB (PACKAGE or STAFF_SEAT).
// - Keep a friendly `description` for human-readable billing tables.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe"; // ✅ central Stripe instance
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  // 1. Stripe requires raw body + signature for webhook verification
  const sig = req.headers.get("stripe-signature")!;
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    // 2. Verify the webhook is authentic
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    // 3. We only care about completed checkout sessions
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Ensure we have the minimum info
      if (session.amount_total && session.metadata?.userId) {
        // Default values
        let description = "Generic Payment";
        let purpose: "PACKAGE" | "STAFF_SEAT" = "PACKAGE";

        // 🎯 Differentiate staff seat vs package
        if (session.metadata?.purpose === "STAFF_SEAT") {
          purpose = "STAFF_SEAT";
          description = `Staff Seat Payment for ${session.metadata.staffEmail || "staff member"}`;
        } else if (session.metadata?.description) {
          // Fallback for package subscription purchases
          description = session.metadata.description;
          purpose = "PACKAGE";
        }

        // 4. Save into Prisma (purpose enum is now strongly typed)
        await prisma.payment.create({
          data: {
            userId: session.metadata.userId,
            amount: session.amount_total / 100, // cents → dollars
            currency: (session.currency || "AUD").toUpperCase(),
            stripeId: session.id,
            description,
            purpose, // ✅ enum field
          },
        });
      }
    }

    // 5. Always ACK Stripe (otherwise it retries)
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[Webhook] handler error:", e);
    return new NextResponse("Server error", { status: 500 });
  }
}

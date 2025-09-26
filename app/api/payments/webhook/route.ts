// app/api/payments/webhook/route.ts
//
// Purpose:
// - Handle Stripe webhook events (secure via signature).
// - Save payments into Prisma with a clear purpose field (enum).
// - Differentiate between PACKAGE purchases vs STAFF_SEAT purchases.
//
// Updates in this version:
// - Removed duplicate local Stripe instance, now always use lib/stripe.ts.
// - Persist `purpose` enum into DB.
// - If metadata.purpose === "STAFF_SEAT" → purpose = STAFF_SEAT.
// - Else → default to PACKAGE (subscriptions, general purchases).
// - Adds description fallback for clarity in billing history.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe"; // ✅ central Stripe instance
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  // 1. Extract signature + raw body (required for Stripe verification)
  const sig = req.headers.get("stripe-signature")!;
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    // 2. Verify webhook authenticity with Stripe secret
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    // 3. Only handle successful checkout sessions
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.amount_total && session.metadata?.userId) {
        let description = "Generic Payment";
        let purpose: "PACKAGE" | "STAFF_SEAT" = "PACKAGE";

        // 🎯 If this was a staff seat purchase
        if (session.metadata?.purpose === "STAFF_SEAT") {
          purpose = "STAFF_SEAT";
          description = `Staff Seat Payment for ${session.metadata.staffEmail || "unknown staff"}`;
        } else if (session.metadata?.description) {
          // Fallback for packages (individual / business subscriptions)
          description = session.metadata.description;
          purpose = "PACKAGE";
        }

        // 4. Persist the payment into DB with purpose
        await prisma.payment.create({
          data: {
            userId: session.metadata.userId,
            amount: session.amount_total / 100, // cents → dollars
            currency: (session.currency || "AUD").toUpperCase(),
            stripeId: session.id,
            description,
            purpose, // ✅ NEW
          },
        });
      }
    }

    // 5. Always acknowledge Stripe so retries don’t occur
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[Webhook] handler error:", e);
    return new NextResponse("Server error", { status: 500 });
  }
}

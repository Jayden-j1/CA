// app/api/payments/route.ts
//
// Purpose:
// - Handles starting a Stripe Checkout session for logged-in users.
// - Supports both Individual and Business packages.
// - After checkout, users are redirected back to /dashboard/upgrade with
//   query params (?success=true / ?canceled=true) for clear feedback.
//
// Notes:
// - Any role (USER, BUSINESS_OWNER, ADMIN) can initiate a payment.
// - Stripe session metadata links the payment back to the user for record-keeping.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
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
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // ✅ Safe contextual log
      console.log("[Webhook] Checkout completed", {
        purpose: session.metadata?.purpose,
        userId: session.metadata?.userId,
        businessId: session.metadata?.businessId,
        payerId: session.metadata?.payerId,
        amount: session.amount_total,
      });

      if (session.amount_total && session.metadata?.userId) {
        let description = "Generic Payment";
        let purpose: "PACKAGE" | "STAFF_SEAT" = "PACKAGE";

        if (session.metadata?.purpose === "STAFF_SEAT") {
          purpose = "STAFF_SEAT";
          description = `Staff Seat Payment for ${session.metadata.staffEmail || "staff member"}`;
        } else if (session.metadata?.description) {
          description = session.metadata.description;
          purpose = "PACKAGE";
        }

        await prisma.payment.create({
          data: {
            userId: session.metadata.userId,
            amount: session.amount_total / 100,
            currency: (session.currency || "AUD").toUpperCase(),
            stripeId: session.id,
            description,
            purpose,
          },
        });

        console.log(`[Webhook] Saved payment record`, {
          userId: session.metadata.userId,
          purpose,
          amount: session.amount_total / 100,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("[Webhook] Handler error:", {
      message: e.message,
      stack: e.stack,
      timestamp: new Date().toISOString(),
    });
    return new NextResponse("Server error", { status: 500 });
  }
}

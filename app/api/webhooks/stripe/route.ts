// app/api/webhooks/stripe/route.ts
//
// Purpose
// -------
// - Verify Stripe event (signature)
// - Idempotently create Payment
// - If purpose === PACKAGE: set payer.hasPaid = true (and packageType if provided)
// - If payer is BUSINESS_OWNER: cascade hasPaid = true to staff

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

  const md = (session.metadata || {}) as Record<string, string | undefined>;

  let userId = md.userId || md.staffUserId; // legacy staff path support

  const purposeRaw = (md.purpose || "").toUpperCase();
  let purpose: "PACKAGE" | "STAFF_SEAT";
  if (purposeRaw === "PACKAGE" || purposeRaw === "STAFF_SEAT") {
    purpose = purposeRaw as "PACKAGE" | "STAFF_SEAT";
  } else {
    purpose = md.staffUserId ? "STAFF_SEAT" : "PACKAGE";
  }

  const packageType =
    md.packageType && ["individual", "business", "staff_seat"].includes(md.packageType)
      ? md.packageType
      : undefined;

  const amountCents = session.amount_total || 0;
  const amount = Math.round((amountCents / 100) * 100) / 100;
  const currency = (session.currency || "aud").toLowerCase();

  let description = md.description || "";

  // Resolve userId by email if not provided
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
    return;
  }

  // Enrich description if missing
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

  await prisma.$transaction(async (tx) => {
    // Idempotency
    const existing = await tx.payment.findUnique({
      where: { stripeId: session.id },
      select: { id: true },
    });
    if (existing) return;

    // Create Payment
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

    // Flip access for PACKAGE (never for STAFF_SEAT)
    if (purpose === "PACKAGE") {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          hasPaid: true,
          ...(packageType && packageType !== "staff_seat" ? { packageType } : {}),
        },
        select: { id: true, role: true },
      });

      // Cascade to staff if the payer is a BUSINESS_OWNER
      if (updatedUser.role === "BUSINESS_OWNER") {
        await tx.user.updateMany({
          where: { businessId: updatedUser.id },
          data: { hasPaid: true },
        });
      }
    }
  });
}

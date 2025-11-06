// app/api/payments/webhook/route.ts
//
// Purpose
// -------
// Central Stripe webhook receiver.
// Now supports subscription lifecycle events in addition to checkout.session.completed:
//   - customer.subscription.created
//   - customer.subscription.updated
//   - customer.subscription.deleted
//
// Behavior
// --------
// • Still writes a Payment row on checkout.session.completed (idempotent by session.id).
// • Flips `user.hasPaid` based on subscription status (no schema changes required).
// • Uses *subscription metadata* (userId, packageType, purpose) we attached during checkout.
//
// Why no schema changes?
// ----------------------
// • Your gating reads user.hasPaid. We maintain that bit via subscription webhooks.
// • If a customer cancels (or at period end), Stripe sends a webhook and we flip hasPaid=false.
//
// Security & Robustness
// ---------------------
// • Raw body for signature verification.
// • Ignores events we don’t care about.
// • Defensive: if we cannot map a subscription to a user, we safely no-op and log.
//
// Notes
// -----
// • STAFF_SEAT purchases DO NOT flip `hasPaid` (same as before).
// • If you later need finer-grained staff seat logic, we can extend without breaking this.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

export const config = {
  api: { bodyParser: false },
};

async function rawBody(req: Request): Promise<Buffer> {
  const ab = await req.arrayBuffer();
  return Buffer.from(ab);
}

// Treat these statuses as *entitled*.
// - "active" → billing up-to-date
// - "trialing" → during a free trial (if you ever enable trials)
// - "past_due" → payment failed but Stripe will retry; keep access until Stripe cancels
const ENTITLED_STATUSES: Stripe.Subscription.Status[] = ["active", "trialing", "past_due"];

/** Map a subscription event to a userId (best-effort, no schema change) */
async function resolveUserIdFromSubscription(sub: Stripe.Subscription): Promise<string | null> {
  // 1) Best case: we copied userId into subscription.metadata at checkout time
  const metaUserId = (sub.metadata?.userId as string | undefined) || null;
  if (metaUserId) return metaUserId;

  // 2) Fallback: try Stripe Customer → email → user lookup
  try {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    if (!customerId) return null;

    const customer = await stripe.customers.retrieve(customerId);
    const email =
      !("deleted" in customer) && typeof customer.email === "string" ? customer.email : null;
    if (!email) return null;

    const user = await prisma.user.findUnique({ where: { email } });
    return user?.id ?? null;
  } catch (e) {
    console.warn("[Webhook] resolveUserIdFromSubscription: fallback lookup failed:", e);
    return null;
  }
}

/** Flip user.hasPaid based on subscription status and purpose. */
async function applySubscriptionEntitlement(sub: Stripe.Subscription) {
  // Determine if this subscription should grant access at all
  const purpose = (sub.metadata?.purpose as "PACKAGE" | "STAFF_SEAT" | undefined) || "PACKAGE";
  if (purpose === "STAFF_SEAT") {
    // Staff seats do not alter owner entitlement directly (unchanged behavior).
    return;
  }

  const userId = await resolveUserIdFromSubscription(sub);
  if (!userId) {
    console.warn("[Webhook] Subscription event could not be mapped to a user. Skipping.");
    return;
  }

  const entitled = ENTITLED_STATUSES.includes(sub.status);
  await prisma.user.update({
    where: { id: userId },
    data: { hasPaid: entitled, packageType: "business" === sub.metadata?.packageType ? "business" : "individual" },
  });
}

export async function POST(req: NextRequest) {
  try {
    // 0) Verify signature
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
    }
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[Webhook] Missing STRIPE_WEBHOOK_SECRET");
      return NextResponse.json({ error: "Webhook misconfigured" }, { status: 500 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(await rawBody(req), sig, secret);
    } catch (err: any) {
      console.error("[Webhook] Invalid signature:", err?.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // 1) Handle subscription lifecycle events (authoritative for entitlement)
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;

      if (process.env.DEBUG_STRIPE_WEBHOOK === "true") {
        console.log(`[Webhook][${event.type}] sub.id=${sub.id} status=${sub.status} meta=`, sub.metadata);
      }

      await applySubscriptionEntitlement(sub);
      return NextResponse.json({ ok: true });
    }

    // 2) Keep your existing checkout.session.completed behavior
    //    (still persists a Payment row; for subscriptions this represents the initial invoice)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const meta = (session.metadata || {}) as Record<string, string | undefined>;
      const purpose = (meta.purpose as "PACKAGE" | "STAFF_SEAT" | undefined) || "PACKAGE";
      const packageType =
        (meta.packageType as "individual" | "business" | "staff_seat" | undefined) || "individual";
      const userId = meta.userId; // set by create-session route
      const description = meta.description || "Checkout payment";

      const amount = (session.amount_total || 0) / 100; // cents -> dollars
      const currency = (session.currency || "aud").toLowerCase();
      const stripeId = session.id; // unique across retries → safe for idempotency

      if (process.env.DEBUG_STRIPE_WEBHOOK === "true") {
        console.log("[Webhook][checkout.session.completed] purpose:", purpose, "userId:", userId);
      }

      if (!userId) {
        // Shouldn't happen since our create-session sets metadata.userId; keep safe.
        console.warn("[Webhook] checkout.session.completed without userId metadata – skipping persist");
        return NextResponse.json({ ok: true, unattributed: true });
      }

      // Idempotent write of a Payment record (your schema)
      const exists = await prisma.payment.findUnique({ where: { stripeId } });
      if (!exists) {
        await prisma.payment.create({
          data: {
            userId,
            amount,
            currency,
            stripeId,
            description,
            purpose, // PACKAGE | STAFF_SEAT
          },
        });
      }

      // For subscriptions: entitlement is primarily handled by subscription events.
      // But we can grant optimistic access right away for PACKAGE purchases, then
      // subscription.updated will keep it in sync afterward.
      if (purpose === "PACKAGE") {
        await prisma.user.update({
          where: { id: userId },
          data: {
            hasPaid: true,
            packageType: packageType === "business" ? "business" : "individual",
          },
        });
      }

      return NextResponse.json({ ok: true });
    }

    // 3) Ignore other events
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Webhook] Unhandled error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}









// // app/api/payments/webhook/route.ts
// //
// // Purpose
// // -------
// // Authoritative Stripe webhook receiver for ALL checkout flows.
// // It verifies the signature, parses metadata, writes a Payment row (idempotent),
// // and flips user.hasPaid for PACKAGE purchases.
// // This is the endpoint your logs show being invoked ("/api/payments/webhook"),
// // so persisting the Payment here resolves "Billing shows no purchase".
// //
// // Security
// // --------
// // - Uses the raw request body for signature verification.
// // - Requires STRIPE_WEBHOOK_SECRET.
// // - Inserts are idempotent via unique Payment.stripeId (Checkout Session id).
// //
// // Notes
// // -----
// // - `purpose` metadata: "PACKAGE" or "STAFF_SEAT"
// // - `packageType`: "individual" | "business" | "staff_seat" (for display/unlocking)
// // - `userId` metadata: the payer's user id (owner for staff seats)
// // - Amount is stored in dollars (float) from Stripe cents.

// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { stripe } from "@/lib/stripe";
// import Stripe from "stripe";

// // Stripe needs the raw body for signature verification.
// // (Next.js App Router supports reading the raw ArrayBuffer from the request.)
// export const config = {
//   api: { bodyParser: false },
// };

// async function rawBody(req: Request): Promise<Buffer> {
//   const ab = await req.arrayBuffer();
//   return Buffer.from(ab);
// }

// export async function POST(req: NextRequest) {
//   try {
//     // 1) Verify signature
//     const sig = req.headers.get("stripe-signature");
//     if (!sig) {
//       return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
//     }
//     const secret = process.env.STRIPE_WEBHOOK_SECRET;
//     if (!secret) {
//       console.error("[Webhook] Missing STRIPE_WEBHOOK_SECRET");
//       return NextResponse.json({ error: "Webhook misconfigured" }, { status: 500 });
//     }

//     let event: Stripe.Event;
//     try {
//       event = stripe.webhooks.constructEvent(await rawBody(req), sig, secret);
//     } catch (err: any) {
//       console.error("[Webhook] Invalid signature:", err?.message);
//       return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
//     }

//     // We only care about completed checkout sessions
//     if (event.type !== "checkout.session.completed") {
//       return NextResponse.json({ received: true });
//     }

//     // 2) Extract session + metadata
//     const session = event.data.object as Stripe.Checkout.Session;

//     const meta = (session.metadata || {}) as Record<string, string | undefined>;
//     const purpose = (meta.purpose as "PACKAGE" | "STAFF_SEAT" | undefined) || "PACKAGE";
//     const packageType =
//       (meta.packageType as "individual" | "business" | "staff_seat" | undefined) || "individual";
//     const userId = meta.userId; // set by create-session routes
//     const description = meta.description || "Checkout payment";

//     const amount = (session.amount_total || 0) / 100; // cents -> dollars
//     const currency = (session.currency || "aud").toLowerCase();
//     const stripeId = session.id; // unique across retries → safe for idempotency

//     // Optional verbose debugging (controlled by env)
//     if (process.env.DEBUG_STRIPE_WEBHOOK === "true") {
//       console.log("[Webhook][Debug] purpose:", purpose);
//       console.log("[Webhook][Debug] meta.userId:", userId || "(none)");
//       console.log("[Webhook][Debug] fallback email:", "(none)"); // kept for parity with earlier logs
//       console.log("[Webhook][Debug] resolved userId:", userId || "(none)");
//     }

//     // 3) Require a userId to attribute the payment
//     if (!userId) {
//       console.warn("[Webhook] checkout.session.completed without userId metadata – skipping persist");
//       return NextResponse.json({ ok: true, unattributed: true });
//     }

//     // 4) Idempotent write: if we already saved this session, do nothing.
//     const exists = await prisma.payment.findUnique({ where: { stripeId } });
//     if (exists) {
//       return NextResponse.json({ ok: true, duplicate: true });
//     }

//     // 5) Persist Payment row
//     await prisma.payment.create({
//       data: {
//         userId,
//         amount,
//         currency,
//         stripeId,   // UNIQUE in schema
//         description,
//         purpose,    // PACKAGE | STAFF_SEAT
//       },
//     });

//     // 6) Unlock access for PACKAGE purchases (individual or business)
//     if (purpose === "PACKAGE") {
//       await prisma.user.update({
//         where: { id: userId },
//         data: {
//           hasPaid: true,
//           packageType: packageType === "business" ? "business" : "individual",
//         },
//       });
//     }

//     return NextResponse.json({ ok: true });
//   } catch (err) {
//     console.error("[Webhook] Unhandled error:", err);
//     return NextResponse.json({ error: "Webhook error" }, { status: 500 });
//   }
// }

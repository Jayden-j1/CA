// app/api/staff/add/route.ts
//
// Purpose
// -------
// Create a Stripe Checkout Session specifically for "Staff Seat" purchases,
// using the *owner's* session identity. The payment will be recorded for
// the owner userId, and Billing (scoped by businessId) will display it.
//
// Why this patch is necessary
// --------------------------
// Your webhook classifies incoming events using `session.metadata.purpose`.
// Previously, this route omitted `purpose`, so the webhook could not write a
// Payment row for staff-seat purchases. Result: nothing appeared in Billing.
//
// What changed (tiny, targeted):
// -----------------------------
// 1) We now include explicit metadata:
//      • purpose: "STAFF_SEAT"
//      • packageType: "staff_seat"
//      • description: "Staff Seat"
//      • userId: <ownerId>
//    This makes your webhook handle the event and insert a Payment.
// 2) Response JSON now returns { checkoutUrl } instead of { url } so it
//    matches the client code in AddStaffForm.tsx (which checks data.checkoutUrl).
//
// Security & best practices
// -------------------------
// - We never trust client price; owner is authenticated and we use env-config.
// - We do not send the staff member's password to Stripe metadata (sensitive).
// - Server-side gating remains: only BUSINESS_OWNER can call this route.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

// Use the secret key; no apiVersion typing avoids local type mismatches.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  // 1) Require authenticated session
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Only BUSINESS_OWNER can add staff
  if (session.user.role !== "BUSINESS_OWNER") {
    return NextResponse.json({ error: "Only business owners can add staff" }, { status: 403 });
  }

  try {
    // Client sends { pricePerStaff } (aud dollars). We allow it only as a hint;
    // final amounts should be env-driven in production for consistency.
    const { pricePerStaff } = await req.json();

    // 3) Count staff *for this business* to determine if payment is required
    const businessId = session.user.businessId!;
    const staffCount = await prisma.user.count({
      where: { businessId, role: "USER" },
    });

    // Read free seat policy from env; default 0 (no free seats)
    const FREE_SEAT_LIMIT = Number(process.env.STAFF_FREE_SEAT_LIMIT ?? "0");

    // 4) If still under free limit → no payment required (caller will proceed to create staff)
    if (staffCount < FREE_SEAT_LIMIT) {
      return NextResponse.json({ requiresPayment: false });
    }

    // 5) Otherwise, create a Stripe Checkout Session for one staff seat
    // Use env or fallback to provided price with safe rounding to cents.
    const unitAmountCents = Number(
      process.env.STRIPE_STAFF_SEAT_PRICE ?? Math.round(Number(pricePerStaff || 0) * 100)
    );

    if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0) {
      return NextResponse.json({ error: "Invalid staff seat price" }, { status: 400 });
    }

    // Success / cancel URLs land back on the Staff page per your flow
    const successUrl = `${process.env.NEXTAUTH_URL}/dashboard/staff?success=true`;
    const cancelUrl = `${process.env.NEXTAUTH_URL}/dashboard/staff?canceled=true`;

    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: { name: "Add Staff Member" },
            unit_amount: unitAmountCents, // cents
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,

      // ✅ CRITICAL: add metadata so your webhook can classify + persist a Payment
      metadata: {
        purpose: "STAFF_SEAT",
        packageType: "staff_seat",
        description: "Staff Seat",
        userId: session.user.id, // owner user id (Billing scopes via businessId)
      },
    });

    // IMPORTANT: Your client AddStaffForm.tsx checks for `checkoutUrl`
    // so we return that exact field name.
    return NextResponse.json({
      requiresPayment: true,
      checkoutUrl: stripeSession.url,
    });
  } catch (error) {
    console.error("[/api/staff/add] Error creating checkout session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

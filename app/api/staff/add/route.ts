// app/api/staff/add/route.ts
//
// Purpose
// -------
// Create a Stripe Checkout Session specifically for "Staff Seat" purchases.
// The payment is attributed to the *owner* (payer), but we now also include
// the *beneficiary* (staff) in Stripe metadata so the webhook can persist a
// clear description. This lets the Billing UI show the *staff* identity
// in the "User" column for STAFF_SEAT payments.
//
// What changed (surgical, backward-compatible):
// - We *optionally* accept name/email/isAdmin in the POST body (as already sent
//   by your AddStaffForm) and pass them through as Stripe metadata:
//     • staffEmail
//     • staffName
//     • staffRole ("ADMIN" | "USER")
// - Nothing else about the flow is touched.
//
// Security:
// - Server still gates: BUSINESS_OWNER or business-scoped ADMIN only.
// - We never trust client price; unit_amount uses env (fallback only if needed).
//
// Pillars:
// - Efficiency: no extra DB work here.
// - Robustness: all fields optional; existing flows keep working.
// - Simplicity: metadata-only for downstream display.
// - Ease of management: minimal, well-commented diff.
// - Security: gating + env-driven pricing unchanged.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  // 1) Require authenticated session
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Allow BUSINESS_OWNER and business-scoped ADMIN (ADMIN with businessId)
  const isOwner = session.user.role === "BUSINESS_OWNER";
  const isBizAdmin = session.user.role === "ADMIN" && !!session.user.businessId;
  if (!isOwner && !isBizAdmin) {
    return NextResponse.json({ error: "Only business owners or business admins can add staff" }, { status: 403 });
  }

  try {
    // We accept both the newer "hint-only" body and the existing form payload.
    const body = await req.json();

    // Price hint (never trusted in prod—env rules the real price)
    const pricePerStaff = Number(body?.pricePerStaff ?? 0);

    // Optional staff identity passed from AddStaffForm (non-breaking)
    const staffName: string | undefined = body?.name || body?.staffName || undefined;
    const staffEmail: string | undefined = body?.email || body?.staffEmail || undefined;
    const staffRole: "ADMIN" | "USER" | undefined =
      body?.staffRole ||
      (typeof body?.isAdmin === "boolean" ? (body.isAdmin ? "ADMIN" : "USER") : undefined);

    // 3) Count current staff for this business to determine if payment is required
    const businessId = session.user.businessId!;
    const staffCount = await prisma.user.count({
      where: { businessId, role: "USER", isActive: true },
    });

    const FREE_SEAT_LIMIT = Number(process.env.STAFF_FREE_SEAT_LIMIT ?? "0");

    if (staffCount < FREE_SEAT_LIMIT) {
      // Under the free limit → no Stripe session, caller continues with free creation
      return NextResponse.json({ requiresPayment: false });
    }

    // 4) Build unit amount in cents from env (fallback to provided hint)
    const unitAmountCents = Number(
      process.env.STRIPE_STAFF_SEAT_PRICE ?? Math.round(pricePerStaff * 100)
    );
    if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0) {
      return NextResponse.json({ error: "Invalid staff seat price" }, { status: 400 });
    }

    // 5) Success / cancel URLs land back on the Staff page per your flow
    const baseUrl = process.env.NEXTAUTH_URL!;
    const successUrl = `${baseUrl}/dashboard/staff?success=true${staffEmail ? `&staff=${encodeURIComponent(staffEmail)}` : ""}`;
    const cancelUrl = `${baseUrl}/dashboard/staff?canceled=true`;

    // 6) Create a Stripe Checkout Session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: { name: "Add Staff Member" },
            unit_amount: unitAmountCents,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,

      // ✅ Critical metadata for downstream webhook/UX
      metadata: {
        purpose: "STAFF_SEAT",
        packageType: "staff_seat",
        description: "Staff Seat",
        userId: session.user.id,            // payer (owner/admin of this business)
        // beneficiary (optional; used only for display in Billing)
        ...(staffEmail ? { staffEmail } : {}),
        ...(staffName ? { staffName } : {}),
        ...(staffRole ? { staffRole } : {}),
      },
    });

    return NextResponse.json({
      requiresPayment: true,
      checkoutUrl: stripeSession.url,
    });
  } catch (error) {
    console.error("[/api/staff/add] Error creating checkout session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

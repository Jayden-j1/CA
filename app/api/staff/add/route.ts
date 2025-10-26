// app/api/staff/add/route.ts
//
// Purpose
// -------
// Create a Stripe Checkout Session for *Staff Seat* purchases. We attribute the
// payment to the *payer* (owner/admin) but now also pass the *beneficiary*
// (staff) in metadata so Billing can show the correct person in the "User" column.
//
// What changed (surgical):
// - Accept optional staff identity fields from the AddStaff form.
// - Include staffEmail/staffName/staffRole in Stripe metadata.
// - Everything else (pricing, auth, redirects) is unchanged.
//
// Security:
// - Only BUSINESS_OWNER or business-scoped ADMIN can call.
// - We still prefer env pricing; client price is only a fallback.
//
// Pillars: efficiency (no extra DB ops), robustness (all fields optional),
// simplicity (metadata only), security (server gating), ease of mgmt (tiny diff).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  // 1) Auth
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isOwner = session.user.role === "BUSINESS_OWNER";
  const isBizAdmin = session.user.role === "ADMIN" && !!session.user.businessId;
  if (!isOwner && !isBizAdmin) {
    return NextResponse.json({ error: "Only business owners or business admins can add staff" }, { status: 403 });
  }

  try {
    // 2) Parse body (AddStaffForm sends these)
    const body = await req.json();
    const pricePerStaff = Number(body?.pricePerStaff ?? 0);

    // Optional: staff identity for Billing display
    const staffName: string | undefined = body?.name || body?.staffName || undefined;
    const staffEmail: string | undefined = body?.email || body?.staffEmail || undefined;
    const staffRole: "ADMIN" | "USER" | undefined =
      body?.staffRole ||
      (typeof body?.isAdmin === "boolean" ? (body.isAdmin ? "ADMIN" : "USER") : undefined);

    // 3) Free-seat check (business-scoped)
    const businessId = session.user.businessId!;
    const staffCount = await prisma.user.count({
      where: { businessId, role: "USER", isActive: true },
    });
    const FREE_SEAT_LIMIT = Number(process.env.STAFF_FREE_SEAT_LIMIT ?? "0");
    if (staffCount < FREE_SEAT_LIMIT) {
      return NextResponse.json({ requiresPayment: false });
    }

    // 4) Price (prefer env; fall back to provided hint)
    const unitAmountCents = Number(
      process.env.STRIPE_STAFF_SEAT_PRICE ?? Math.round(pricePerStaff * 100)
    );
    if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0) {
      return NextResponse.json({ error: "Invalid staff seat price" }, { status: 400 });
    }

    // 5) Success/cancel
    const baseUrl = process.env.NEXTAUTH_URL!;
    const successUrl = `${baseUrl}/dashboard/staff?success=true${
      staffEmail ? `&staff=${encodeURIComponent(staffEmail)}` : ""
    }`;
    const cancelUrl = `${baseUrl}/dashboard/staff?canceled=true`;

    // 6) Stripe session with *beneficiary* metadata
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
      metadata: {
        purpose: "STAFF_SEAT",
        packageType: "staff_seat",
        description: "Staff Seat",
        userId: session.user.id, // payer (owner/admin)
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

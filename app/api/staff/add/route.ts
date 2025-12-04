// app/api/staff/add/route.ts
//
// PURPOSE (unchanged): Create a Stripe Checkout Session for one staff seat,
// charging the OWNER/ADMIN, but tagging the session so the webhook can later
// display the *staff* identity correctly in Billing.
//
// ✅ Display fix: persist "STAFF_SEAT:<staffEmail>" in metadata.description.
// The webhook saves that into Payment.description, and the Billing API parses
// it to swap in the staff user’s identity for that line item.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!["BUSINESS_OWNER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json(
      { error: "Only business owners/admins can add staff" },
      { status: 403 }
    );
  }

  try {
    const { pricePerStaff, staffEmail } = await req.json();

    // Count current active staff for free-seat logic (unchanged)
    const businessId = session.user.businessId!;
    const staffCount = await prisma.user.count({
      where: { businessId, role: "USER", isActive: true },
    });
    const FREE_SEAT_LIMIT = Number(process.env.STAFF_FREE_SEAT_LIMIT ?? "0");
    if (staffCount < FREE_SEAT_LIMIT) {
      return NextResponse.json({ requiresPayment: false });
    }

    const unitAmountCents = Number(
      process.env.STRIPE_STAFF_SEAT_PRICE ?? Math.round(Number(pricePerStaff || 0) * 100)
    );
    if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0) {
      return NextResponse.json({ error: "Invalid staff seat price" }, { status: 400 });
    }

    const urlBase = process.env.NEXTAUTH_URL!;
    const qp = staffEmail ? `&staff=${encodeURIComponent(staffEmail)}` : "";
    const successUrl = `${urlBase}/dashboard/staff?success=true${qp}`;
    const cancelUrl = `${urlBase}/dashboard/staff?canceled=true${qp}`;

    // ✅ The one critical line: structured description with staff email
    const structuredDesc =
      staffEmail && typeof staffEmail === "string" && staffEmail.includes("@")
        ? `STAFF_SEAT:${staffEmail}`
        : "Staff Seat";

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
        description: structuredDesc,  // <-- drives Billing user identity
        userId: session.user.id,      // owner paying (scoping rule unchanged)
        ...(staffEmail ? { staffEmail } : {}),
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










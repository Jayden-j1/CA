// app/api/staff/add/route.ts
//
// Purpose:
// - Allow BUSINESS_OWNER/ADMIN to add staff AND immediately start a Stripe Checkout session.
// - The Checkout session ensures the new staff member's access is only unlocked after payment.
// - Metadata ensures your webhook links the Payment to the *staff user*, not just the payer.
//
// Flow:
//  1) Verify authentication + role.
//  2) Validate inputs.
//  3) Create staff user (role=USER, business-linked).
//  4) Create Stripe Checkout session → metadata.userId = staff.id.
//  5) Return checkoutUrl so client redirects to Stripe.
//
// Notes:
// - If payment is canceled, staff user exists but has no Payment → no access until paid.
// - This is acceptable, as your gating logic checks Payment table for access.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import Stripe from "stripe";

// ✅ Stripe client (no explicit apiVersion to avoid type mismatch)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    // 1) Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Allow only BUSINESS_OWNER or ADMIN
    if (
      session.user.role !== "BUSINESS_OWNER" &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3) Parse request body
    const { name, email, password, businessId } = await req.json();

    if (!name || !email || !password || !businessId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 4) Ensure owner can only add staff to their own business
    if (
      session.user.role === "BUSINESS_OWNER" &&
      session.user.businessId !== businessId
    ) {
      return NextResponse.json(
        { error: "You can only add staff to your own business" },
        { status: 403 }
      );
    }

    // 5) Prevent duplicate users
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "A user with that email already exists" },
        { status: 400 }
      );
    }

    // 6) Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 7) Create staff user
    const staff = await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword,
        role: "USER",
        businessId,
      },
      select: { id: true, email: true, businessId: true },
    });

    // 8) Create Stripe Checkout session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "aud", // Default AUD — can make dynamic later
            product_data: { name: `Staff seat for ${email}` },
            unit_amount: 9900, // $99.00 AUD in cents
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/dashboard/staff?success=true&staff=${encodeURIComponent(
        staff.email
      )}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/staff?canceled=true&staff=${encodeURIComponent(
        staff.email
      )}`,
      metadata: {
        userId: staff.id, // staff that payment unlocks
        payerId: session.user.id, // business owner/admin
        businessId: staff.businessId || "",
        purpose: "STAFF_SEAT",
      },
    });

    // 9) Respond with checkoutUrl
    return NextResponse.json(
      {
        message: "Staff created, redirect to Stripe Checkout",
        staffId: staff.id,
        checkoutUrl: stripeSession.url,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Staff add error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", systemError: true },
      { status: 500 }
    );
  }
}

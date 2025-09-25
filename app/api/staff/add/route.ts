// app/api/staff/add/route.ts
//
// Purpose:
// - Allow BUSINESS_OWNER/ADMIN to add staff AND immediately start a Stripe Checkout session.
// - Ensures that staff access is only unlocked after successful payment.
// - Stripe metadata links the payment to the *staff user*, not just the payer.
//
// Flow:
//  1) Verify authentication + role (must be BUSINESS_OWNER or ADMIN).
//  2) Validate request inputs.
//  3) Create staff user in the database (role = USER, linked to business).
//  4) Start a Stripe Checkout session (payment required for access).
//  5) Redirect after payment → back to /dashboard/staff with success/cancel.
//  6) Return Stripe checkout URL to frontend for redirect.
//
// Notes:
// - If payment is canceled → staff user exists but has *no payment record*.
//   This means access remains locked until a valid Payment is stored.
// - Business logic can later check `Payment` table for entitlement.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import Stripe from "stripe";

// ✅ Initialize Stripe client using secret key from .env
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    // ------------------------------
    // 1) Verify authentication
    // ------------------------------
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ------------------------------
    // 2) Allow only BUSINESS_OWNER or ADMIN
    // ------------------------------
    if (
      session.user.role !== "BUSINESS_OWNER" &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ------------------------------
    // 3) Parse + validate request body
    // ------------------------------
    const { name, email, password, businessId } = await req.json();

    if (!name || !email || !password || !businessId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Ensure BUSINESS_OWNER can only add staff to *their own* business
    if (
      session.user.role === "BUSINESS_OWNER" &&
      session.user.businessId !== businessId
    ) {
      return NextResponse.json(
        { error: "You can only add staff to your own business" },
        { status: 403 }
      );
    }

    // ------------------------------
    // 4) Prevent duplicate users
    // ------------------------------
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "A user with that email already exists" },
        { status: 400 }
      );
    }

    // ------------------------------
    // 5) Hash password securely
    // ------------------------------
    const hashedPassword = await bcrypt.hash(password, 10);

    // ------------------------------
    // 6) Create staff user (role = USER)
    // ------------------------------
    const staff = await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword,
        role: "USER", // staff = regular user role
        businessId,
      },
      select: { id: true, email: true, businessId: true },
    });

    // ------------------------------
    // 7) Create Stripe Checkout session
    // ------------------------------
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment", // one-time purchase
      line_items: [
        {
          price_data: {
            currency: "aud", // default AUD for now
            product_data: { name: `Staff seat for ${email}` },
            unit_amount: 9900, // $99.00 AUD in cents
          },
          quantity: 1,
        },
      ],
      // ✅ Success/cancel now redirect to /dashboard/staff
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
        purpose: "STAFF_SEAT", // makes it clear in webhook what this payment is for
      },
    });

    // ------------------------------
    // 8) Return checkout URL to frontend
    // ------------------------------
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

// app/api/staff/add/route.ts
//
// Purpose:
// - Adds a staff member (USER or ADMIN) to a business.
// - Immediately creates a Stripe Checkout session for billing the staff seat.
// - Prevents duplicate users and ensures only authorized roles can add staff.
//
// Improvements in this version:
// - Added **debug logging** of the Stripe API key prefix/length to diagnose "Invalid API Key" errors.
// - Logs are sanitized (never print the full key, only first/last 4 chars).
// - Stripe price logic reuses STRIPE_STAFF_SEAT_PRICE env (no hardcoding).
//
// ⚠️ Remember: remove debug logs once you’ve confirmed your env setup.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Only Business Owners or Admins can add staff
    if (session.user.role !== "BUSINESS_OWNER" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Parse request body
    const body = await req.json();
    const { name, email, password, isAdmin } = body;
    let { businessId } = body;

    if (!businessId && session.user.businessId) {
      businessId = session.user.businessId;
    }

    if (!name || !email || !password || !businessId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 4. Prevent owners adding staff to other businesses
    if (
      session.user.role === "BUSINESS_OWNER" &&
      session.user.businessId !== businessId
    ) {
      return NextResponse.json(
        { error: "You can only add staff to your own business" },
        { status: 403 }
      );
    }

    // 5. Prevent duplicate emails
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "A user with that email already exists" }, { status: 400 });
    }

    // 6. Hash password & assign role
    const hashedPassword = await bcrypt.hash(password, 10);
    const role = isAdmin ? "ADMIN" : "USER";

    // 7. Create the staff record
    const staff = await prisma.user.create({
      data: { name, email, hashedPassword, role, businessId },
      select: { id: true, email: true, businessId: true, role: true },
    });

    // 8. Create Stripe Checkout session
    const staffPrice = parseInt(process.env.STRIPE_STAFF_SEAT_PRICE || "5000", 10); // cents
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: { name: `Staff seat for ${email}` },
            unit_amount: staffPrice,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?success=true&staff=${encodeURIComponent(staff.email)}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?canceled=true&staff=${encodeURIComponent(staff.email)}`,
      metadata: {
        userId: staff.id,
        payerId: session.user.id,
        businessId: staff.businessId || "",
        purpose: "STAFF_SEAT",
        role: staff.role,
      },
    });

    // ✅ Safe log (no secrets)
    console.log("[Stripe] Checkout Session Created", {
      staffId: staff.id,
      businessId: staff.businessId,
      purpose: "STAFF_SEAT",
      amount: staffPrice,
    });

    return NextResponse.json(
      { message: "Staff created, redirect to Stripe Checkout", staffId: staff.id, checkoutUrl: stripeSession.url },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Staff add error:", {
      errorType: (error as any)?.type,
      message: (error as any)?.message,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ error: "Internal Server Error", systemError: true }, { status: 500 });
  }
}

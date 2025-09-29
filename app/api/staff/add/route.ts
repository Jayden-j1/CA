// app/api/staff/add/route.ts
//
// Purpose:
// - Business Owner/Admin can add a staff member (USER or ADMIN) to their business.
// - Immediately creates a Stripe Checkout session to bill for the staff seat.
// - Metadata is carefully set so that the webhook saves the payment
//   against the new staff user (not the owner).
//
// Why this matters:
// - If metadata.userId is missing or wrong → staff account won’t unlock map/course.
// - By including description, payerId, and businessId we maintain
//   a clear audit trail while still tying the payment to the staff account.
//
// Security:
// - Only authenticated Business Owners/Admins may call this endpoint.
// - Prevents creating staff under the wrong business.
// - Prevents duplicate user emails.
// - Passwords are securely hashed with bcrypt.
//

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    // 1) Require authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Only allow Business Owners or Admins to add staff
    if (session.user.role !== "BUSINESS_OWNER" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3) Parse request body
    const body = await req.json();
    const { name, email, password, isAdmin } = body;
    let { businessId } = body;

    // If businessId not explicitly provided, fallback to the caller’s businessId
    if (!businessId && session.user.businessId) {
      businessId = session.user.businessId;
    }

    if (!name || !email || !password || !businessId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 4) Prevent Business Owners from adding staff to *another* business
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

    // 6) Hash password and set role
    const hashedPassword = await bcrypt.hash(password, 10);
    const role = isAdmin ? "ADMIN" : "USER";

    // 7) Create staff record in DB
    const staff = await prisma.user.create({
      data: { name, email, hashedPassword, role, businessId },
      select: { id: true, email: true, businessId: true, role: true },
    });

    // 8) Resolve Stripe price (always from env, in cents)
    const staffPrice = parseInt(process.env.STRIPE_STAFF_SEAT_PRICE || "5000", 10);

    // 9) Create Stripe Checkout session
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
      // Redirects back to internal dashboard pages
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?success=true&staff=${encodeURIComponent(staff.email)}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?canceled=true&staff=${encodeURIComponent(staff.email)}`,
      // ✅ Metadata is CRITICAL: this is how webhook knows who this payment is for
      metadata: {
        userId: staff.id,                                 // 🟢 ensure payment is tied to *staff* account
        payerId: session.user.id,                         // 📝 the business owner/admin who paid
        businessId: staff.businessId || "",               // 🔗 business association
        purpose: "STAFF_SEAT",                            // distinguish from PACKAGE payments
        role: staff.role,                                 // mostly for audit/debug
        description: `Staff Seat for ${staff.email}`,     // 🟢 used in webhook → clear description in DB
      },
    });

    // ✅ Safe log (never expose full keys/secrets)
    console.log("[Stripe] Staff Checkout Session Created", {
      staffId: staff.id,
      staffEmail: staff.email,
      businessId: staff.businessId,
      payerId: session.user.id,
      amount: staffPrice,
    });

    // Respond with checkout URL to client
    return NextResponse.json(
      {
        message: "Staff created, redirect to Stripe Checkout",
        staffId: staff.id,
        checkoutUrl: stripeSession.url,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Staff add error:", {
      errorType: (error as any)?.type,
      message: (error as any)?.message,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Internal Server Error", systemError: true },
      { status: 500 }
    );
  }
}

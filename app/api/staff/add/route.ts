// app/api/staff/add/route.ts
//
// Updated to:
// - Accept `isAdmin` from request body.
// - If true, create staff with role = "ADMIN".
// - Otherwise default to "USER".
// - Rest of logic (payment, Stripe session, auth) unchanged.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      session.user.role !== "BUSINESS_OWNER" &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ✅ Parse request body
    const { name, email, password, businessId, isAdmin } = await req.json();
    if (!name || !email || !password || !businessId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (
      session.user.role === "BUSINESS_OWNER" &&
      session.user.businessId !== businessId
    ) {
      return NextResponse.json(
        { error: "You can only add staff to your own business" },
        { status: 403 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "A user with that email already exists" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Role assignment: based on isAdmin flag
    const role = isAdmin ? "ADMIN" : "USER";

    const staff = await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword,
        role,
        businessId,
      },
      select: { id: true, email: true, businessId: true },
    });

    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: { name: `Staff seat for ${email}` },
            unit_amount: 9900,
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
        userId: staff.id,
        payerId: session.user.id,
        businessId: staff.businessId || "",
        purpose: "STAFF_SEAT",
      },
    });

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

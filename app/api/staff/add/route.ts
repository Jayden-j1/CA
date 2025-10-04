// app/api/staff/add/route.ts
//
// Purpose:
// - Allow BUSINESS_OWNER or ADMIN to add staff users into their business.
// - Owner/Admin supplies a default password (validated + hashed).
// - New staff are always created with mustChangePassword = true.
// - If under free staff limit → user created immediately, no payment.
// - If over free staff limit → user still created, then owner is redirected to Stripe checkout.
//   Stripe metadata contains **userId** and **purpose=STAFF_SEAT** so the webhook can
//   correctly persist a Payment row that unlocks the staff account.
//
// Why this fixes your issues:
// - Previously, metadata didn't include `userId` nor `purpose`, so the webhook
//   couldn't attach the payment to the staff user (no DB row → locked pages).
// - With correct metadata, the webhook writes a `Payment{ purpose: 'STAFF_SEAT' }`
//   for the staff's userId. Your gating + billing then see the payment immediately.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import bcrypt from "bcryptjs";
import { isStrongPassword } from "@/lib/validator";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  // --- 1. Verify session + role ---
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "BUSINESS_OWNER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only business owners or admins can add staff" }, { status: 403 });
  }

  try {
    // --- 2. Parse body ---
    const { name, email, password, isAdmin, businessId } = await req.json();
    if (!name || !email || !password || !businessId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // --- 3. Validate password strength (same rule as signup) ---
    if (!isStrongPassword(password)) {
      return NextResponse.json(
        { error: "Password too weak: must include upper, lower, number, special, 8+ chars" },
        { status: 400 }
      );
    }

    // --- 4. Hash password ---
    const hashedPassword = await bcrypt.hash(password, 10);

    // --- 5. Count existing staff (role USER only; admins are elevated) ---
    const staffCount = await prisma.user.count({
      where: { businessId, role: "USER" },
    });
    const freeStaffLimit = 1; // allow N free staff seats

    // --- 6. Create the staff user first (robust, avoids dangling stripe sessions) ---
    const staffUser = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        hashedPassword,
        role: isAdmin ? "ADMIN" : "USER",
        businessId,
        isActive: true,
        mustChangePassword: true, // ✅ enforce first login reset
      },
    });

    // --- 7. Free seat flow: done. ---
    if (staffCount < freeStaffLimit) {
      return NextResponse.json({
        requiresPayment: false,
        message: "Staff user created successfully",
        staffUserId: staffUser.id,
      });
    }

    // --- 8. Paid seat flow: create Stripe checkout session with CORRECT metadata ---
    const pricePerStaff =
      Number(process.env.STAFF_SEAT_PRICE) ||
      Number(process.env.NEXT_PUBLIC_STAFF_SEAT_PRICE) ||
      50; // sensible fallback

    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: { name: "Staff Seat" },
            unit_amount: Math.round(pricePerStaff * 100), // cents
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/dashboard/staff?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/staff?canceled=true`,
      // 👇👇 THE IMPORTANT PART: tell the webhook who and what this payment is for
      metadata: {
        userId: staffUser.id,               // ✅ webhook saves payment for THIS staff user
        purpose: "STAFF_SEAT",              // ✅ ensures purpose is saved as STAFF_SEAT
        description: "Staff Seat",          // helpful default
        businessId,                         // audit / optional
        addedBy: session.user.id,           // audit / optional
      },
    });

    return NextResponse.json({ requiresPayment: true, checkoutUrl: stripeSession.url });
  } catch (error) {
    console.error("[/api/staff/add] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

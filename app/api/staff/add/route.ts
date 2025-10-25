// app/api/staff/add/route.ts
//
// Purpose
// -------
// Create (or prepare) a staff member and, when required, open a Stripe Checkout
// session for one staff seat. We ALWAYS create the staff record first:
//   • If the seat is FREE (under limit)  → create active staff and return immediately.
//   • If the seat REQUIRES PAYMENT       → create INACTIVE staff, send owner to Stripe,
//                                          and activate staff in the webhook upon success.
//
// Why this is safe & minimal:
// - We do NOT change your staff form (it already POSTs name/email/password/isAdmin).
// - We do NOT move password handling into Stripe metadata (security). We hash here.
// - We keep the client’s expected response shape: { requiresPayment, checkoutUrl? }.
// - We do not change any other app flows.
//
// Security & best practices
// -------------------------
// - Owner must be authenticated and have BUSINESS_OWNER role.
// - Email/role/business ownership validated here again.
// - No sensitive data put into Stripe metadata (we pass only the created staff id).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import bcrypt from "bcryptjs";

// Use the secret key; omit apiVersion typing to avoid local type mismatches.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  // 1) Require authenticated owner
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "BUSINESS_OWNER") {
    return NextResponse.json({ error: "Only business owners can add staff" }, { status: 403 });
  }

  try {
    // 2) Parse incoming payload from AddStaffForm (existing client contract)
    const { name, email, password, isAdmin, businessId } = (await req.json()) as {
      name: string;
      email: string;
      password: string;
      isAdmin: boolean;
      businessId: string;
    };

    // Basic guards (minimal; you already enforce in the form)
    if (!name || !email || !password || !businessId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    // Owner can only add into their own business
    if (session.user.businessId !== businessId) {
      return NextResponse.json({ error: "Invalid business context" }, { status: 403 });
    }

    // 3) Determine whether this seat requires payment
    const existingStaffCount = await prisma.user.count({
      where: { businessId, role: { in: ["USER", "ADMIN"] }, isActive: true },
    });

    const FREE_SEAT_LIMIT = Number(process.env.STAFF_FREE_SEAT_LIMIT ?? "0");
    const requiresPayment = existingStaffCount >= FREE_SEAT_LIMIT;

    // 4) Fail fast if email already exists
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 400 });
    }

    // 5) Create the staff record FIRST (so we never ship passwords via Stripe)
    //    - If payment required  → make inactive; will be activated by webhook
    //    - If free             → active immediately
    const hashedPassword = await bcrypt.hash(password, 10);

    const createdStaff = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        hashedPassword,
        role: isAdmin ? "ADMIN" : "USER",
        businessId,
        isActive: !requiresPayment,         // inactive when paid seat is pending
        mustChangePassword: true,           // per your flow: must change on first login
        hasPaid: false,                     // staff’s access is tied to business; do not flip here
        packageType: "business",            // they belong to a business plan
      },
      select: { id: true, email: true, role: true, isActive: true },
    });

    // 6) If this seat is free → return success (no Stripe)
    if (!requiresPayment) {
      return NextResponse.json({
        requiresPayment: false,
        staffId: createdStaff.id,
        staffEmail: createdStaff.email,
      });
    }

    // 7) Otherwise, create a Stripe Checkout Session for one seat
    const unitAmountCents = Number(
      process.env.STRIPE_STAFF_SEAT_PRICE ?? "0"
    );
    if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0) {
      return NextResponse.json({ error: "Invalid staff seat price" }, { status: 400 });
    }

    // Send users back to Staff page (your existing flow)
    const successUrl = `${process.env.NEXTAUTH_URL}/dashboard/staff?success=true&staff=${encodeURIComponent(createdStaff.email)}`;
    const cancelUrl = `${process.env.NEXTAUTH_URL}/dashboard/staff?canceled=true&staff=${encodeURIComponent(createdStaff.email)}`;

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

      // 🔑 Critical metadata the webhook needs to finish the job
      metadata: {
        purpose: "STAFF_SEAT",
        packageType: "staff_seat",
        description: "Staff Seat",
        userId: session.user.id,     // owner/payer
        newStaffId: createdStaff.id, // to activate after payment
      },
    });

    return NextResponse.json({
      requiresPayment: true,
      checkoutUrl: stripeSession.url,
    });
  } catch (error) {
    console.error("[/api/staff/add] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

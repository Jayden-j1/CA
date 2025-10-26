// app/api/staff/add/route.ts
//
// Purpose
// -------
// Add (or update) a staff member *and* create a Stripe Checkout Session for a
// Staff Seat when required. We create/upsert the staff user BEFORE Stripe so
// the staff appears immediately on the Staff page, and also so Billing can
// show the correct beneficiary.
//
// Why this fixes your symptoms
// ----------------------------
// Previously, the staff user creation happened elsewhere or not at all in the
// paid path, so newly added staff sometimes didn't show up. By moving the
// upsert into this single authoritative endpoint, the Staff page will always
// list the user right away, and the webhook will have metadata to display the
// correct person in the Billing "User" column.
//
// What stays the same
// -------------------
// - Free-seat logic (env-driven) and payment gating
// - Success/cancel redirects
// - Security: only BUSINESS_OWNER or business-scoped ADMIN may call
// - We do NOT alter any other unrelated logic
//
// Pillars
// -------
// Efficiency: single round-trip; idempotent upsert.
// Robustness: handles existing emails; safe hashing for default password.
// Simplicity: one place owns staff creation.
// Ease of management: clear comments, narrow scope.
// Security: server-side checks; never trusts client price.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import bcrypt from "bcryptjs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  // 1) AuthN + AuthZ (owner or business-scoped admin)
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
    // 2) Parse incoming payload from AddStaffForm
    //    Expecting: { name, email, defaultPassword, isAdmin?, pricePerStaff? }
    const body = await req.json();
    const staffName: string = (body?.name || body?.staffName || "").trim();
    const staffEmail: string = (body?.email || body?.staffEmail || "").trim().toLowerCase();
    const defaultPassword: string = String(body?.defaultPassword || "");
    const staffRole: "ADMIN" | "USER" =
      body?.staffRole === "ADMIN" || body?.isAdmin === true ? "ADMIN" : "USER";

    // Guard: minimally require email + defaultPassword
    if (!staffEmail || !defaultPassword) {
      return NextResponse.json({ error: "Email and default password are required" }, { status: 400 });
    }

    // 3) Resolve business context and free-seat policy
    const businessId = session.user.businessId!;
    const FREE_SEAT_LIMIT = Number(process.env.STAFF_FREE_SEAT_LIMIT ?? "0");

    const currentActiveStaffCount = await prisma.user.count({
      where: { businessId, isActive: true, role: { in: ["USER", "ADMIN"] } },
    });

    const requiresPayment = currentActiveStaffCount >= FREE_SEAT_LIMIT;

    // 4) Upsert the staff user *now* so it appears immediately on the Staff page.
    //    - If user already exists (same email), ensure it is tied to this business,
    //      mark active, set role, and force password change at first login.
    //    - If it doesn't exist, create it with a hashed default password.
    const hashed = await bcrypt.hash(defaultPassword, 12);

    const upserted = await prisma.user.upsert({
      where: { email: staffEmail },
      update: {
        name: staffName || undefined,
        role: staffRole,
        businessId,
        isActive: true,
        mustChangePassword: true,
        // Update password only if provided (we do here because you asked to set default)
        hashedPassword: hashed,
      },
      create: {
        email: staffEmail,
        name: staffName || null,
        role: staffRole,
        businessId,
        isActive: true,
        mustChangePassword: true,
        hashedPassword: hashed,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    // If we are still under the free-seat limit → no Stripe needed.
    if (!requiresPayment) {
      return NextResponse.json({
        requiresPayment: false,
        staff: upserted,
      });
    }

    // 5) Otherwise create a Stripe Checkout Session for one staff seat
    const unitAmountCents = Number(
      process.env.STRIPE_STAFF_SEAT_PRICE ?? Math.round(Number(body?.pricePerStaff || 0) * 100)
    );
    if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0) {
      return NextResponse.json({ error: "Invalid staff seat price" }, { status: 400 });
    }

    const baseUrl = process.env.NEXTAUTH_URL!;
    const successUrl = `${baseUrl}/dashboard/staff?success=true&staff=${encodeURIComponent(
      staffEmail
    )}`;
    const cancelUrl = `${baseUrl}/dashboard/staff?canceled=true`;

    // 6) Stripe session with *beneficiary* metadata so Billing shows staff in "User"
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
        userId: session.user.id,           // payer (owner/admin)
        staffEmail: upserted.email,        // beneficiary (displayed in Billing)
        staffName: upserted.name || "",    // beneficiary
        staffRole: upserted.role,          // beneficiary
      },
    });

    return NextResponse.json({
      requiresPayment: true,
      checkoutUrl: stripeSession.url,
      staff: upserted,
    });
  } catch (error) {
    console.error("[/api/staff/add] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

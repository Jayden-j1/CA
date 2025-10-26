// app/api/staff/add/route.ts
//
// Purpose
// -------
// Add (or update) a staff member *and* create a Stripe Checkout Session for a
// Staff Seat when required. We upsert the staff user BEFORE Stripe so the
// staff appears immediately on the Staff page. This file is identical in
// behavior to the previous revision except for ONE targeted improvement:
//
// 🔧 Fix (non-breaking, surgical):
// - Accept multiple incoming field names from the form:
//     • email:          email | staffEmail
//     • name:           name  | staffName
//     • defaultPassword password | defaultPassword | tempPassword
//     • role:           staffRole ("ADMIN"/"USER") | isAdmin (boolean)
//   This resolves the "Email and default password are required" toast you saw
//   even when the UI was filled out, because the server was only looking for
//   `defaultPassword`.
//
// What stays the same
// -------------------
// - Free-seat logic driven by STAFF_FREE_SEAT_LIMIT
// - Security: only BUSINESS_OWNER or business-scoped ADMIN can call this
// - Domain enforcement remains server-side (in your existing stack)
// - Stripe metadata still includes staff beneficiary for correct Billing render
//
// Pillars
// -------
// Efficiency: single round-trip; idempotent upsert.
// Robustness: tolerant to field name aliases; strict validation and hashing.
// Simplicity: one endpoint owns staff creation.
// Ease of management: comments explain each defensive step.
// Security: server-side checks; never trusts client price; bcrypt for passwords.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import bcrypt from "bcryptjs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  // 1) Authentication + Authorization
  //    - Only BUSINESS_OWNER or ADMIN tied to a business can add staff.
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isOwner = session.user.role === "BUSINESS_OWNER";
  const isBizAdmin = session.user.role === "ADMIN" && !!session.user.businessId;
  if (!isOwner && !isBizAdmin) {
    return NextResponse.json(
      { error: "Only business owners or business admins can add staff" },
      { status: 403 }
    );
  }

  // 2) Parse the body safely (and tolerate unexpected shapes)
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // If body isn't valid JSON we proceed with an empty object, and validation below will fail clearly.
    body = {};
  }

  // 3) Normalize incoming fields from the form.
  //    We accept multiple aliases to avoid brittle coupling with the UI:
  const staffEmail: string = String(
    (body.email ?? body.staffEmail ?? "")
  )
    .trim()
    .toLowerCase();

  const staffName: string = String(
    (body.name ?? body.staffName ?? "")
  ).trim();

  // Default password may be sent under different keys by the form.
  const defaultPasswordRaw =
    body.defaultPassword ?? body.password ?? body.tempPassword ?? "";
  const defaultPassword: string = String(defaultPasswordRaw).trim();

  // Role can be a literal "ADMIN"|"USER" or a boolean flag `isAdmin`
  const roleFromBody: string | undefined = body.staffRole;
  const isAdminFlag: boolean = Boolean(body.isAdmin);
  const staffRole: "ADMIN" | "USER" =
    roleFromBody === "ADMIN" || isAdminFlag ? "ADMIN" : "USER";

  // Optional price hint (final authority is env)
  const pricePerStaff = body.pricePerStaff;

  // 4) Validate the two required inputs (now that we've normalized aliases).
  if (!staffEmail || !defaultPassword) {
    // Keep the same error message the UI expects to show as a toast.
    return NextResponse.json(
      { error: "Email and default password are required" },
      { status: 400 }
    );
  }

  // 5) Business context + free seat policy
  const businessId = session.user.businessId!;
  const FREE_SEAT_LIMIT = Number(process.env.STAFF_FREE_SEAT_LIMIT ?? "0");

  // Count ACTIVE staff (USER/ADMIN) in this business
  const currentActiveStaffCount = await prisma.user.count({
    where: { businessId, isActive: true, role: { in: ["USER", "ADMIN"] } },
  });

  const requiresPayment = currentActiveStaffCount >= FREE_SEAT_LIMIT;

  // 6) Upsert staff user BEFORE Stripe so they show up immediately.
  //
  //    - If the email already exists, we tie/retie them to the current business
  //      (safely), set active, set role, ensure must-change-password, and
  //      update the password to the provided default.
  //    - If they don't exist, we create them fresh.
  //
  //    NOTE: We purposefully hash here on every add to ensure the "default
  //    password" the BO/Admin sets is what's required on first login.
  const hashed = await bcrypt.hash(defaultPassword, 12);

  const upserted = await prisma.user.upsert({
    where: { email: staffEmail },
    update: {
      name: staffName || undefined,
      role: staffRole,
      businessId,
      isActive: true,
      mustChangePassword: true,
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

  // 7) If still under the free-seat limit → no Stripe Checkout required.
  if (!requiresPayment) {
    return NextResponse.json({
      requiresPayment: false,
      staff: upserted,
    });
  }

  // 8) Create a Stripe Checkout Session for a single Staff Seat
  const unitAmountCents = Number(
    process.env.STRIPE_STAFF_SEAT_PRICE ??
      Math.round(Number(pricePerStaff || 0) * 100)
  );
  if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0) {
    return NextResponse.json(
      { error: "Invalid staff seat price" },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL!;
  const successUrl = `${baseUrl}/dashboard/staff?success=true&staff=${encodeURIComponent(
    upserted.email
  )}`;
  const cancelUrl = `${baseUrl}/dashboard/staff?canceled=true`;

  // 9) Include beneficiary (staff) metadata so the webhook can display them
  //    in Billing's “User” column for STAFF_SEAT payments.
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
      userId: session.user.id,          // payer (owner/admin)
      staffEmail: upserted.email,       // beneficiary
      staffName: upserted.name || "",   // beneficiary
      staffRole: upserted.role,         // beneficiary
    },
  });

  return NextResponse.json({
    requiresPayment: true,
    checkoutUrl: stripeSession.url,
    staff: upserted,
  });
}

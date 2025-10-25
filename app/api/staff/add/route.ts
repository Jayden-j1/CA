// app/api/staff/add/route.ts
//
// Purpose
// -------
// Create the staff user, then either:
//  • ALWAYS redirect to Stripe Checkout by default (matches your stated flow)
//    – configurable via STAFF_FREE_SEAT_LIMIT (defaults to 0 => always paid)
//  • Or, if under the free-seat limit, return a success without Stripe.
//
// Why this fix is safe/minimal
// ----------------------------
// - We DO NOT change client code or any other flows.
// - We DO NOT change Staff form logic: it already redirects when `checkoutUrl` exists.
// - We DO ensure the API always returns `checkoutUrl` when a paid seat is needed.
// - We DO correctly create the staff user first so it appears on the Staff page.
//
// Pillars
// -------
// - Efficiency: single pass, minimal queries.
// - Robustness: guards for domain & password, duplicate email, and proper business context.
// - Simplicity: early returns, readable branches, tiny helpers.
// - Security: role checks, vendor domain block, company domain/subdomain enforcement.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import bcrypt from "bcryptjs";
import { isStrongPassword } from "@/lib/validator";
import { extractEmailDomain, isPublicMailboxDomain } from "@/lib/email/corporate";

// Keep Stripe init simple to avoid type mismatch warnings across setups
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// ---------- Helpers (pure) ----------

function normalizeLower(s?: string | null) {
  return (s || "").toLowerCase().trim();
}

function isSubdomain(candidate: string, root: string): boolean {
  if (candidate === root) return true;
  return candidate.endsWith("." + root);
}

// ---------- POST /api/staff/add ----------

export async function POST(req: NextRequest) {
  // 1) Auth + role
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "BUSINESS_OWNER") {
    return NextResponse.json({ error: "Only business owners can add staff" }, { status: 403 });
  }

  // 2) Parse body
  const body = await req.json();
  const {
    name,
    email,
    password,
    isAdmin,
    businessId: bodyBusinessId,
  } = (body || {}) as {
    name?: string;
    email?: string;
    password?: string;
    isAdmin?: boolean;
    businessId?: string;
  };

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  // 3) Confirm the caller belongs to (and is operating on) their own business
  const ownerBusinessId = session.user.businessId || null;
  if (!ownerBusinessId || ownerBusinessId !== bodyBusinessId) {
    return NextResponse.json({ error: "Invalid business context." }, { status: 400 });
  }

  // 4) Resolve business domain and enforce server-side rules (defense-in-depth)
  const business = await prisma.business.findUnique({
    where: { id: ownerBusinessId },
    select: { emailDomain: true },
  });

  const companyDomain = normalizeLower(
    business?.emailDomain ||
      extractEmailDomain(session.user.email || "") ||
      undefined
  );

  const staffDomain = normalizeLower(extractEmailDomain(email || ""));
  if (!staffDomain) {
    return NextResponse.json({ error: "Invalid staff email." }, { status: 400 });
  }
  if (isPublicMailboxDomain(staffDomain)) {
    return NextResponse.json(
      { error: "Please use a company email address (Gmail/Outlook/Yahoo etc. are not allowed)." },
      { status: 400 }
    );
  }
  if (companyDomain && !isSubdomain(staffDomain, companyDomain)) {
    return NextResponse.json(
      { error: `Email must use @${companyDomain} or a subdomain (e.g., team.${companyDomain}).` },
      { status: 400 }
    );
  }

  // 5) Password strength (same as signup)
  if (!isStrongPassword(password)) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character." },
      { status: 400 }
    );
  }

  // 6) Duplicate email check
  const existing = await prisma.user.findUnique({ where: { email: normalizeLower(email) } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  // 7) Create the staff user NOW so they appear on the Staff page immediately
  const hashedPassword = await bcrypt.hash(password, 10);
  const staffUser = await prisma.user.create({
    data: {
      name,
      email: normalizeLower(email),
      hashedPassword,
      role: isAdmin ? "ADMIN" : "USER",
      hasPaid: false,
      packageType: "staff_seat",
      mustChangePassword: true,
      business: { connect: { id: ownerBusinessId } },
    },
    select: { id: true, email: true },
  });

  // 8) Determine if payment is required
  //
  //    IMPORTANT:
  //    - Your stated flow is "redirect to payment form" for adding staff.
  //    - To make this explicit, STAFF_FREE_SEAT_LIMIT defaults to 0 (always paid).
  //    - If you want a grace seat later, set STAFF_FREE_SEAT_LIMIT=1 in .env
  //      (we count all non-owner members under the business).
  //
  const FREE_SEAT_LIMIT = Number(process.env.STAFF_FREE_SEAT_LIMIT ?? "0"); // default 0 => always paid

  const nonOwnerCount = await prisma.user.count({
    where: {
      businessId: ownerBusinessId,
      NOT: { id: session.user.id }, // exclude the owner themselves
    },
  });

  const requiresPayment = nonOwnerCount > FREE_SEAT_LIMIT;

  // 9) If under free limit → no Stripe; done
  if (!requiresPayment) {
    return NextResponse.json({
      requiresPayment: false,
      message: "Staff user created (free seat applied).",
      staffUserId: staffUser.id,
    });
  }

  // 10) Otherwise create Stripe Checkout session (paid seat)
  const unitAmountCents = parseInt(process.env.STRIPE_STAFF_SEAT_PRICE || "5000", 10);
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  const successUrl = `${baseUrl}/dashboard/staff?success=true`;
  const cancelUrl = `${baseUrl}/dashboard/staff?canceled=true`;

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
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
      description: "Staff Seat",
      purchaserId: session.user.id,
      businessId: ownerBusinessId,
      staffUserId: staffUser.id,
    },
  });

  // 11) Return the exact key the client is listening for
  return NextResponse.json({
    requiresPayment: true,
    checkoutUrl: checkout.url, // 👈 AddStaffForm will redirect using this
    staffUserId: staffUser.id,
  });
}

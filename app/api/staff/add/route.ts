// app/api/staff/add/route.ts
//
// Purpose
// -------
// Create a new staff user for the current business owner, then either:
//   • If under free seat limit -> return success (no Stripe)
//   • Else -> create a Stripe Checkout session and return { checkoutUrl } so
//             the client can redirect to Stripe for payment.
//
// Why this change?
// ----------------
// - The previous version didn't create the staff user at all (so the Staff list stayed empty).
// - The response key was `url`, but your form expects `checkoutUrl` to redirect.
// - We now also enforce server-side domain rules (vendor mailboxes blocked + must match company domain).
//
// Security & Pillars
// ------------------
// - Authz: only BUSINESS_OWNER can call this route.
// - Validations: blocks public mailbox domains, enforces company domain or subdomain.
// - Robustness: idempotent-ish behavior via unique email; friendly 409 on duplicates.
// - Observability: logs only minimal, non-sensitive info.
// - Simplicity: single linear flow with early returns; uses Prisma transaction only when needed.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import bcrypt from "bcryptjs";
import { isStrongPassword } from "@/lib/validator";
import { extractEmailDomain, isPublicMailboxDomain } from "@/lib/email/corporate";

//  No apiVersion to avoid type mismatch warnings in some setups
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// --------- Small helpers (pure) ---------

function normalizeLower(s?: string | null) {
  return (s || "").toLowerCase().trim();
}

function isSubdomain(candidate: string, root: string): boolean {
  // Accept exact domain or any subdomain (e.g., team.example.com endsWith .example.com)
  if (candidate === root) return true;
  return candidate.endsWith("." + root);
}

// --------- POST /api/staff/add ---------

export async function POST(req: NextRequest) {
  // 1) Require auth and correct role
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "BUSINESS_OWNER") {
    return NextResponse.json({ error: "Only business owners can add staff" }, { status: 403 });
  }

  // 2) Parse payload
  const body = await req.json();
  const {
    name,
    email,
    password,
    isAdmin,
    businessId: bodyBusinessId,        // client sends this; we still re-check vs session for safety
  } = (body || {}) as {
    name?: string;
    email?: string;
    password?: string;
    isAdmin?: boolean;
    businessId?: string;
  };

  // 3) Validate required fields
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  // 4) Ensure the requester actually has a business
  const ownerBusinessId = session.user.businessId || null;
  if (!ownerBusinessId || ownerBusinessId !== bodyBusinessId) {
    return NextResponse.json({ error: "Invalid business context." }, { status: 400 });
  }

  // 5) Resolve the business's human-visible domain (if any)
  //    We trust the Business table (authoritative), but if null we fallback to owner email's host.
  const business = await prisma.business.findUnique({
    where: { id: ownerBusinessId },
    select: { emailDomain: true },
  });
  const companyDomain = normalizeLower(
    business?.emailDomain ||
      extractEmailDomain(session.user.email || "") ||
      undefined
  );

  // 6) Server-side domain enforcement (defense-in-depth)
  const staffDomain = normalizeLower(extractEmailDomain(email || ""));
  if (!staffDomain) {
    return NextResponse.json({ error: "Invalid staff email." }, { status: 400 });
  }
  // Block vendor/public mailbox domains outright
  if (isPublicMailboxDomain(staffDomain)) {
    return NextResponse.json(
      { error: "Please use a company email address (Gmail/Outlook/Yahoo etc. are not allowed)." },
      { status: 400 }
    );
  }
  // If we have a company domain on record, enforce it (exact or subdomain)
  if (companyDomain && !isSubdomain(staffDomain, companyDomain)) {
    return NextResponse.json(
      { error: `Email must use @${companyDomain} or a subdomain (e.g., team.${companyDomain}).` },
      { status: 400 }
    );
  }

  // 7) Password strength (same rule as signup)
  if (!isStrongPassword(password)) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character." },
      { status: 400 }
    );
  }

  // 8) Check for duplicate email
  const existing = await prisma.user.findUnique({ where: { email: normalizeLower(email) } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  // 9) Create the staff user now (so they appear immediately on the Staff page).
  //    - mustChangePassword: true (they’ll be forced to update on first login)
  //    - role: ADMIN if isAdmin else USER
  //    - hasPaid is false; access is inherited by business purchase anyway
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

  // 10) Determine if a paid seat is required
  //     Count USER/ADMIN (non-owner) under this business; owner is not counted as "staff".
  const staffCount = await prisma.user.count({
    where: {
      businessId: ownerBusinessId,
      // any non-owner roles count as "staff"
      NOT: { id: session.user.id },
    },
  });

  const freeStaffLimit = 1; // adjust if needed
  const requiresPayment = staffCount > freeStaffLimit;

  // 11) If under free limit -> done (no Stripe). Staff is created and will show on Staff page.
  if (!requiresPayment) {
    return NextResponse.json({
      requiresPayment: false,
      message: "Staff user created (free seat applied).",
      staffUserId: staffUser.id,
    });
  }

  // 12) Otherwise, create a Stripe Checkout session for +1 staff seat.
  //     We write rich metadata so the webhook can record the payment.
  const unitAmountCents = parseInt(process.env.STRIPE_STAFF_SEAT_PRICE || "5000", 10);
  const successUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?success=true`;
  const cancelUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?canceled=true`;

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

  // 13) Return the key your form already expects to redirect.
  return NextResponse.json({
    requiresPayment: true,
    checkoutUrl: checkout.url,
    staffUserId: staffUser.id,
  });
}

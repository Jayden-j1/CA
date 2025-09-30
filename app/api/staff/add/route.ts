// app/api/staff/add/route.ts
//
// Purpose:
// - Business Owner/Admin can add a staff member (USER or ADMIN) to their business.
// - Immediately creates a Stripe Checkout session to bill for the staff seat.
// - CRITICAL: Enforce that staff email domain matches the business domain.
// - If Business.domain is empty the first time, auto-derive it from the caller's email
//   (e.g., owner@example.com → example.com) and persist it.
//
// Security:
// - Only authenticated Business Owners/Admins may call this endpoint.
// - Prevents creating staff under the wrong business.
// - Prevents duplicate user emails.
// - Passwords are securely hashed with bcrypt.
// - Server-side domain restriction prevents bypassing any client-side checks.
//
// Stripe:
// - Metadata ties the payment to the staff account (userId = staff.id).
// - Includes payerId + businessId for audit trails.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { stripe } from "@/lib/stripe";

/**
 * Extract the domain part from an email address.
 * - Returns null if email is invalid or missing '@'.
 * - Lowercases for consistent comparison.
 *
 * Examples:
 *  - "Alice@Example.com" -> "example.com"
 *  - "bob.smith@sub.example.com" -> "sub.example.com" (we do not flatten)
 */
function extractDomain(email: string | undefined | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

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

    // 5) Load the Business to enforce domain rule
    //    (Admins with a businessId are also supported here)
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, domain: true, ownerId: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 400 });
    }

    // 5a) Ensure Business.domain exists; if not, auto-derive from the caller's email
    //     and persist it for future adds.
    let effectiveDomain = (business.domain || "").toLowerCase().trim();
    if (!effectiveDomain) {
      const callerDomain = extractDomain(session.user.email);
      if (!callerDomain) {
        return NextResponse.json(
          { error: "Unable to derive business domain from your account email" },
          { status: 400 }
        );
      }

      // Try to persist it once so business has a canonical domain from now on
      try {
        const updated = await prisma.business.update({
          where: { id: business.id },
          data: { domain: callerDomain },
          select: { domain: true },
        });
        effectiveDomain = updated.domain.toLowerCase();
        console.log("[Staff/Add] Business domain set to:", effectiveDomain);
      } catch (e: any) {
        // In rare cases, domain uniqueness may clash; still fall back to enforcing
        // with callerDomain in memory for this request
        effectiveDomain = callerDomain;
        console.warn(
          "[Staff/Add] Failed to persist business domain; using derived domain for validation:",
          effectiveDomain
        );
      }
    }

    // 6) Enforce staff email must match business domain (case-insensitive)
    const staffEmailDomain = extractDomain(email);
    if (!staffEmailDomain) {
      return NextResponse.json({ error: "Invalid staff email format" }, { status: 400 });
    }

    if (staffEmailDomain !== effectiveDomain) {
      // If you want to also accept subdomains like "sub.example.com", you can relax this
      // check by comparing apex domain. For now, we require exact match to avoid ambiguity.
      return NextResponse.json(
        {
          error: `Email domain mismatch. Staff must use "@${effectiveDomain}"`,
          requiredDomain: effectiveDomain,
        },
        { status: 400 }
      );
    }

    // 7) Prevent duplicate users
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "A user with that email already exists" },
        { status: 400 }
      );
    }

    // 8) Hash password and set role
    const hashedPassword = await bcrypt.hash(password, 10);
    const role = isAdmin ? "ADMIN" : "USER";

    // 9) Create staff record in DB (active by default)
    const staff = await prisma.user.create({
      data: { name, email, hashedPassword, role, businessId },
      select: { id: true, email: true, businessId: true, role: true },
    });

    // 10) Resolve Stripe price (always from env, in cents)
    const staffPrice = parseInt(process.env.STRIPE_STAFF_SEAT_PRICE || "5000", 10);

    // 11) Create Stripe Checkout session for the staff seat
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
      // ✅ Metadata is CRITICAL: webhook ties the payment to the staff account
      metadata: {
        userId: staff.id,                                 // 🟢 tie to staff user account
        payerId: session.user.id,                         // 📝 the business owner/admin who paid
        businessId: staff.businessId || "",               // 🔗 business association
        purpose: "STAFF_SEAT",                            // distinguish from PACKAGE payments
        role: staff.role,                                 // mostly for audit/debug
        description: `Staff Seat for ${staff.email}`,     // 🟢 human-readable description in DB
      },
    });

    // ✅ Safe log (never expose secrets)
    console.log("[Stripe] Staff Checkout Session Created", {
      staffId: staff.id,
      staffEmail: staff.email,
      businessId: staff.businessId,
      payerId: session.user.id,
      amount: staffPrice,
      enforcedDomain: effectiveDomain,
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

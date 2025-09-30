// app/api/staff/add/route.ts
//
// Purpose:
// - Business Owner/Admin can add a staff member (USER or ADMIN) to their business.
// - Immediately creates a Stripe Checkout session to bill for the staff seat.
// - Enforces email domain: staff email must match the business domain (exact or subdomain).
// - Enforces password complexity using lib/validator.isStrongPassword.
// - If Business.domain is missing, auto-derive it from the caller’s email and persist it.
//
// Why enforce domain here?
// - Even if someone bypasses the form and hits the API directly, this route blocks invalid emails.
// - Client-side validation is for UX; server-side validation guarantees security.
//
// Subdomain rule (best practice):
// - Accept same-domain: example.com
// - Accept subdomains: dept.example.com, team.dept.example.com
// - Reject different domains: fakeexample.com, example.org
//
// How the check works:
// - Extract domain from the staff email (the part after "@").
// - Extract canonical business domain (persisted or derived from caller).
// - Allow if (candidate === businessDomain) OR (candidate.endsWith("." + businessDomain)).
//   → This ensures "fakeexample.com" is NOT accepted for "example.com".
//
// Security recap:
// - Only BUSINESS_OWNER or ADMIN can call this endpoint.
// - BUSINESS_OWNER can only add staff to their own businessId.
// - Duplicate emails are blocked.
// - Password is hashed with bcrypt.
// - Stripe metadata ties the payment to the STAFF user (critical).
//
// Developer tips:
// - This endpoint is safe to call from your AddStaffForm. It returns a `checkoutUrl` to redirect
//   the browser to Stripe directly from the client.
//
// Dependencies:
// - NextAuth session: used to authorize caller and get their email/businessId.
// - Prisma: user/business/payment models.
// - Stripe: checkout session creation for the seat purchase.
// - lib/validator: isStrongPassword() for password complexity checks.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { stripe } from "@/lib/stripe";
import { isStrongPassword } from "@/lib/validator";

//
// ---------- Helpers: domain extraction + matching ----------
//

/** Extract lowercase domain from an email address. Returns null if invalid. */
function extractDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

/**
 * Returns true if the candidate domain is allowed under the business domain.
 * Allowed:
 * - candidate === businessDomain
 * - candidate ends with "." + businessDomain (true subdomain)
 *
 * Examples:
 * businessDomain = "example.com"
 * - "example.com"            ✅ (exact)
 * - "dept.example.com"       ✅ (subdomain)
 * - "fakeexample.com"        ❌ (not a subdomain, missing "." boundary)
 */
function isAllowedDomain(candidate: string, businessDomain: string): boolean {
  if (!candidate || !businessDomain) return false;

  if (candidate === businessDomain) return true;
  return candidate.endsWith("." + businessDomain);
}

export async function POST(req: NextRequest) {
  try {
    // -------------------------------------------------------------------
    // 1) Authenticate caller
    // -------------------------------------------------------------------
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only BUSINESS_OWNER or ADMIN can add staff
    const callerRole = session.user.role;
    if (callerRole !== "BUSINESS_OWNER" && callerRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // -------------------------------------------------------------------
    // 2) Parse and validate request body
    // -------------------------------------------------------------------
    // We expect: { name, email, password, isAdmin, businessId? }
    const body = await req.json();
    const { name, email, password, isAdmin } = body;
    let { businessId } = body;

    // Fallback to caller’s businessId if none provided
    if (!businessId && session.user.businessId) {
      businessId = session.user.businessId;
    }

    // Guard against missing required fields
    if (!name || !email || !password || !businessId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // BUSINESS_OWNER cannot add to a different business
    if (callerRole === "BUSINESS_OWNER" && session.user.businessId !== businessId) {
      return NextResponse.json(
        { error: "You can only add staff to your own business" },
        { status: 403 }
      );
    }

    // -------------------------------------------------------------------
    // 3) Enforce strong password
    // -------------------------------------------------------------------
    // Using the shared validator from lib/validator.ts
    if (!isStrongPassword(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------
    // 4) Prevent duplicate users (unique email)
    // -------------------------------------------------------------------
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "A user with that email already exists" },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------
    // 5) Resolve business domain (persist if missing)
    // -------------------------------------------------------------------
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, domain: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 400 });
    }

    let canonicalDomain = (business.domain || "").toLowerCase().trim();

    // If the business doesn't have a domain yet, derive from the caller's email
    // and attempt to save it (so future validations are consistent).
    if (!canonicalDomain) {
      const callerDomain = extractDomain(session.user.email);
      if (!callerDomain) {
        return NextResponse.json(
          { error: "Unable to derive business domain from your email" },
          { status: 400 }
        );
      }

      try {
        const updated = await prisma.business.update({
          where: { id: business.id },
          data: { domain: callerDomain },
          select: { domain: true },
        });
        canonicalDomain = updated.domain.toLowerCase();
        console.log("[Staff/Add] Persisted business domain:", canonicalDomain);
      } catch (e: any) {
        // If persisting fails (e.g., uniqueness), proceed with derived domain as a fallback
        canonicalDomain = callerDomain;
        console.warn(
          "[Staff/Add] Failed to persist business domain; using derived domain:",
          canonicalDomain
        );
      }
    }

    // -------------------------------------------------------------------
    // 6) Enforce staff email domain
    // -------------------------------------------------------------------
    const staffEmailDomain = extractDomain(email);
    if (!staffEmailDomain) {
      return NextResponse.json({ error: "Invalid staff email" }, { status: 400 });
    }

    const domainOk = isAllowedDomain(staffEmailDomain, canonicalDomain);
    if (!domainOk) {
      return NextResponse.json(
        {
          error: `Staff email must use your company domain (exact or subdomain). Allowed: @${canonicalDomain}`,
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------
    // 7) Hash password + decide role for the new staff user
    // -------------------------------------------------------------------
    const hashedPassword = await bcrypt.hash(password, 10);
    const staffRole = isAdmin ? "ADMIN" : "USER";

    // -------------------------------------------------------------------
    // 8) Create the staff record (active by default)
    // -------------------------------------------------------------------
    const staff = await prisma.user.create({
      data: { name, email, hashedPassword, role: staffRole, businessId },
      select: { id: true, email: true, businessId: true, role: true },
    });

    // -------------------------------------------------------------------
    // 9) Create Stripe Checkout session for the staff seat
    // -------------------------------------------------------------------
    const staffPrice = parseInt(process.env.STRIPE_STAFF_SEAT_PRICE || "5000", 10);

    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: { name: `Staff seat for ${email}` },
            unit_amount: staffPrice, // cents
          },
          quantity: 1,
        },
      ],
      // Redirect back to internal dashboard
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?success=true&staff=${encodeURIComponent(
        staff.email
      )}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?canceled=true&staff=${encodeURIComponent(
        staff.email
      )}`,
      // ✅ CRITICAL: metadata to ensure webhook unlocks the *staff* account
      metadata: {
        userId: staff.id, // the STAFF user receiving the seat
        payerId: session.user.id, // business owner/admin who paid
        businessId: staff.businessId || "",
        purpose: "STAFF_SEAT", // distinguishes from PACKAGE payments
        role: staff.role,
        description: `Staff Seat for ${staff.email}`,
      },
    });

    // -------------------------------------------------------------------
    // 10) Respond with checkout URL (client will redirect)
    // -------------------------------------------------------------------
    console.log("[Stripe] Staff Checkout Session Created", {
      staffId: staff.id,
      staffEmail: staff.email,
      businessId: staff.businessId,
      payerId: session.user.id,
      amount: staffPrice,
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
    // -------------------------------------------------------------------
    // 11) Unexpected error handling
    // -------------------------------------------------------------------
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

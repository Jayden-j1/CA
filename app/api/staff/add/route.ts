// app/api/staff/add/route.ts
//
// Purpose:
// - Business Owner/Admin can add a staff member (USER or ADMIN) to their business.
// - Immediately creates a Stripe Checkout session to bill for the staff seat.
// - **Enforces email domain**: staff email must match the business domain (exact or subdomain).
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

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { stripe } from "@/lib/stripe";

//
// ---------- Small helpers ----------
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

    // 6) Resolve the business and ensure it has a canonical domain
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, domain: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 400 });
    }

    let canonicalDomain = (business.domain || "").toLowerCase().trim();

    // If domain missing, auto-derive from the caller's email and persist
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
        // On uniqueness or other constraints, proceed with derived (not persisted)
        canonicalDomain = callerDomain;
        console.warn(
          "[Staff/Add] Failed to persist business domain; using derived domain:",
          canonicalDomain
        );
      }
    }

    // 7) Enforce staff email domain (exact or subdomain)
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

    // 11) Create Stripe Checkout session
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
        description: `Staff Seat for ${staff.email}`,     // 🟢 clear description in DB
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

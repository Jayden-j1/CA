// app/api/staff/add/route.ts
//
// Purpose (tight & focused):
// -------------------------
// Create the staff user *immediately* from the posted form fields,
// then (if required) create a Stripe Checkout session for a paid seat.
// This guarantees the staff member appears in the Staff list right away,
// and the owner proceeds to payment. The webhook logs the Payment for Billing.
//
// Why this change is necessary:
// ----------------------------
// The previous version only created a Checkout Session and never created
// the staff user, so the Staff list stayed empty after redirect. This restores
// the intended flow without changing any other app logic.
//
// Security & constraints (unchanged from your app’s policies):
// ------------------------------------------------------------
// - Only BUSINESS_OWNER can add staff.
// - Staff emails must be valid for the business and not public mailboxes.
// - Passwords must be strong; staff are forced to change on first login.
// - Payments for staff seats are always attributed to the OWNER (userId in metadata).
//
// Notes:
// - We DO NOT store staff fields in Stripe metadata (sensitive).
// - We use STRIPE_STAFF_SEAT_PRICE (cents) or a safe fallback.
// - We return { requiresPayment: boolean, checkoutUrl?: string } to match the client.
// - If under the free seat limit, there's no payment and we respond requiresPayment=false.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import { isStrongPassword } from "@/lib/validator";
import { extractEmailDomain, isPublicMailboxDomain } from "@/lib/email/corporate";

// Stripe secret key (no apiVersion typing to avoid local type mismatches on Windows)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Helper: resolve the effective company domain from the Business record.
// If none is set, we still allow (the client already blocked public mailboxes).
async function getBusinessDomain(businessId: string): Promise<string | null> {
  if (!businessId) return null;
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { emailDomain: true },
  });
  return (business?.emailDomain || null)?.toLowerCase() || null;
}

// Helper: validate that the candidate email is acceptable for this business.
function validateBusinessEmail(candidateEmail: string, businessDomain: string | null): string | null {
  const domain = extractEmailDomain(candidateEmail);
  if (!domain) return "Invalid staff email.";
  if (isPublicMailboxDomain(domain)) {
    return "Public mailboxes (gmail, outlook, yahoo, etc.) are not allowed for staff.";
  }
  if (businessDomain) {
    // Allow exact domain or any subdomain (*.businessDomain)
    const ok = domain === businessDomain || domain.endsWith("." + businessDomain);
    if (!ok) return `Email must use @${businessDomain} or a subdomain.`;
  }
  return null; // OK
}

export async function POST(req: NextRequest) {
  // 1) Require authenticated owner session
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "BUSINESS_OWNER") {
    return NextResponse.json({ error: "Only business owners can add staff" }, { status: 403 });
  }

  const ownerId = session.user.id;
  const businessId = session.user.businessId!;
  if (!businessId) {
    return NextResponse.json({ error: "Business not found for your account" }, { status: 400 });
  }

  try {
    // 2) Parse posted fields from AddStaffForm (client already sends these)
    const body = await req.json();
    const {
      name,
      email,
      password,
      isAdmin,
      pricePerStaff, // optional hint; env should define real price in cents
    } = body as {
      name?: string;
      email?: string;
      password?: string;
      isAdmin?: boolean;
      pricePerStaff?: number;
    };

    // 3) Basic validation
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing name, email, or password." }, { status: 400 });
    }
    if (!isStrongPassword(password)) {
      return NextResponse.json(
        {
          error:
            "Default password must be 8+ characters and include uppercase, lowercase, number, and special character.",
        },
        { status: 400 }
      );
    }

    // 4) Server-side domain validation (defense-in-depth)
    const businessDomain = await getBusinessDomain(businessId);
    const emailErr = validateBusinessEmail(email.toLowerCase(), businessDomain);
    if (emailErr) {
      return NextResponse.json({ error: emailErr }, { status: 400 });
    }

    // 5) Check uniqueness of the staff email
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing && existing.isActive !== false) {
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 400 });
    }

    // 6) Count current staff to decide if payment is required
    const FREE_SEAT_LIMIT = Number(process.env.STAFF_FREE_SEAT_LIMIT ?? "0");
    const staffCount = await prisma.user.count({
      where: { businessId, role: { in: ["USER", "ADMIN"] }, isActive: true },
    });
    const requiresPayment = staffCount >= FREE_SEAT_LIMIT;

    // 7) Create/Upsert the staff user immediately (so they appear in the list right away).
    //    - If a soft-deleted/inactive user with this email exists, we reactivate and update.
    const hashed = await bcrypt.hash(password, 10);
    const staffRole = isAdmin ? "ADMIN" as const : "USER" as const;

    let staffUserId: string;
    if (existing) {
      // Reactivate + update an existing (inactive) account safely
      const updated = await prisma.user.update({
        where: { email: email.toLowerCase() },
        data: {
          name,
          hashedPassword: hashed,
          role: staffRole,
          businessId,
          isActive: true,
          mustChangePassword: true,
        },
        select: { id: true },
      });
      staffUserId = updated.id;
    } else {
      const created = await prisma.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          hashedPassword: hashed,
          role: staffRole,
          businessId,
          isActive: true,
          mustChangePassword: true, // force reset on first login
          hasPaid: false,           // payment belongs to owner, not staff
          packageType: "individual" // irrelevant for staff seats; kept consistent
        },
        select: { id: true },
      });
      staffUserId = created.id;
    }

    // 8) If no payment required, we’re done — staff appears immediately in the list.
    if (!requiresPayment) {
      return NextResponse.json({ requiresPayment: false });
    }

    // 9) Otherwise, create a Stripe Checkout Session for ONE staff seat.
    //    The Payment is attributed to the OWNER (userId = ownerId) via metadata.
    const unitAmountCents = Number(
      process.env.STRIPE_STAFF_SEAT_PRICE ?? Math.round(Number(pricePerStaff || 0) * 100)
    );
    if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0) {
      return NextResponse.json({ error: "Invalid staff seat price" }, { status: 400 });
    }

    const successUrl = `${process.env.NEXTAUTH_URL}/dashboard/staff?success=true&staff=${encodeURIComponent(
      email.toLowerCase()
    )}`;
    const cancelUrl = `${process.env.NEXTAUTH_URL}/dashboard/staff?canceled=true&staff=${encodeURIComponent(
      email.toLowerCase()
    )}`;

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
      // The webhook persists a Payment for the OWNER using this metadata:
      metadata: {
        purpose: "STAFF_SEAT",
        packageType: "staff_seat",
        description: "Staff Seat",
        userId: ownerId,    // OWNER gets charged and credited in Billing
        staffId: staffUserId, // optional (currently not used by webhook)
      },
    });

    return NextResponse.json({
      requiresPayment: true,
      checkoutUrl: stripeSession.url,
    });
  } catch (error) {
    console.error("[/api/staff/add] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

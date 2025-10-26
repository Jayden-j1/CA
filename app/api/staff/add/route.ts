// app/api/staff/add/route.ts
//
// Purpose
// -------
// Add a staff member for a BUSINESS_OWNER.
// - Server validates domain and creates the staff user (inactive or active).
// - If over the free-seat limit, create a Stripe Checkout Session to charge.
// - Webhook (on successful payment) activates the pre-created staff user.
//
// Why this fixes your issues
// --------------------------
// • Staff not appearing: we now PRE-CREATE the user record so it can appear
//   after payment (or immediately if within free-seat limit).
// • Staff-seat purchase missing in Billing: we include purpose=STAFF_SEAT and
//   userId (owner) in metadata; the webhook writes a Payment row.
// • We also set `customer_email` to the owner's email so attribution is robust.
//
// Security
// --------
// - Owner-only route, server-side domain checks, password hashed server-side.
// - No sensitive data in Stripe metadata.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPublicMailboxDomain, extractEmailDomain } from "@/lib/email/corporate";
import Stripe from "stripe";
import bcrypt from "bcryptjs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function sameOrSubdomain(candidate: string, root: string) {
  return candidate === root || candidate.endsWith("." + root);
}

export async function POST(req: NextRequest) {
  // 1) AuthN/AuthZ
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "BUSINESS_OWNER") {
    return NextResponse.json({ error: "Only business owners can add staff" }, { status: 403 });
  }

  try {
    // We accept both the old { pricePerStaff } shape and the new explicit shape.
    const body = await req.json();
    const {
      name,
      email,
      password,
      isAdmin,
      pricePerStaff,
    }: {
      name?: string;
      email?: string;
      password?: string;
      isAdmin?: boolean;
      pricePerStaff?: number;
    } = body || {};

    const ownerId = session.user.id;
    const ownerEmail = session.user.email || undefined;
    const businessId = session.user.businessId!;
    if (!businessId) {
      return NextResponse.json({ error: "Business not found" }, { status: 400 });
    }

    // 2) Resolve allowed domain from Business
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { emailDomain: true },
    });

    const allowedDomain = (business?.emailDomain || "").toLowerCase() || null;
    if (!allowedDomain) {
      return NextResponse.json(
        { error: "Business email domain not configured; contact support." },
        { status: 400 }
      );
    }

    // 3) Free-seat policy and existing staff count
    const FREE_SEAT_LIMIT = Number(process.env.STAFF_FREE_SEAT_LIMIT ?? "0");
    const staffCount = await prisma.user.count({
      where: { businessId, role: { in: ["USER", "ADMIN"] }, isActive: true },
    });

    // 4) If we received staff details, we are in the "create staff" flow.
    if (name && email && password) {
      // 4a) Server-side domain validation (defense-in-depth)
      const domain = extractEmailDomain(email);
      if (!domain || isPublicMailboxDomain(domain) || !sameOrSubdomain(domain, allowedDomain)) {
        return NextResponse.json(
          { error: `Email must use @${allowedDomain} or a subdomain.` },
          { status: 400 }
        );
      }

      // 4b) Prevent duplicate email
      const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existing) {
        return NextResponse.json({ error: "A user with this email already exists." }, { status: 400 });
      }

      const hashed = await bcrypt.hash(password, 10);
      const role: "USER" | "ADMIN" = isAdmin ? "ADMIN" : "USER";

      // 4c) If within free-seat limit → create ACTIVE staff immediately (no Stripe)
      if (staffCount < FREE_SEAT_LIMIT) {
        const staff = await prisma.user.create({
          data: {
            name,
            email: email.toLowerCase(),
            hashedPassword: hashed,
            role,
            businessId,
            isActive: true,
            mustChangePassword: true,
            hasPaid: true, // inherits business access
            packageType: "business",
          },
          select: { id: true, email: true, role: true, createdAt: true },
        });

        return NextResponse.json({
          requiresPayment: false,
          staff,
          message: "Staff added under free-seat policy.",
        });
      }

      // 4d) Over free limit → pre-create INACTIVE staff and start Stripe checkout
      const precreated = await prisma.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          hashedPassword: hashed,
          role,
          businessId,
          isActive: false,          // will be flipped true on webhook success
          mustChangePassword: true, // enforced on first login
          hasPaid: true,            // inherits business access (seat controls activation)
          packageType: "business",
        },
        select: { id: true, email: true },
      });

      const unitAmountCents = Number(
        process.env.STRIPE_STAFF_SEAT_PRICE ??
          Math.round(Number(pricePerStaff || 0) * 100)
      );

      if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0) {
        return NextResponse.json({ error: "Invalid staff seat price" }, { status: 400 });
      }

      const successUrl = `${process.env.NEXTAUTH_URL}/dashboard/staff?success=true&staff=${encodeURIComponent(
        precreated.email
      )}`;
      const cancelUrl = `${process.env.NEXTAUTH_URL}/dashboard/staff?canceled=true&staff=${encodeURIComponent(
        precreated.email
      )}`;

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

        // ✅ So webhook can recover payer if metadata.userId is absent
        customer_email: ownerEmail,

        // ✅ Critical metadata for webhook
        metadata: {
          purpose: "STAFF_SEAT",
          packageType: "staff_seat",
          description: "Staff Seat",
          userId: ownerId,             // who paid (owner)
          newStaffId: precreated.id,   // who to activate after payment
        },
      });

      return NextResponse.json({
        requiresPayment: true,
        checkoutUrl: stripeSession.url,
      });
    }

    // 5) Legacy path: request only asked "do I need to pay?" (no user details yet)
    const needsPayment = staffCount >= FREE_SEAT_LIMIT;
    if (!needsPayment) {
      // Nothing to bill; caller should proceed to actually create the staff via this same route with details.
      return NextResponse.json({ requiresPayment: false });
    }

    // If someone calls this legacy check with a price and no user details, return a Session to pay for one seat.
    const unitAmountCents = Number(
      process.env.STRIPE_STAFF_SEAT_PRICE ??
        Math.round(Number(pricePerStaff || 0) * 100)
    );

    if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0) {
      return NextResponse.json({ error: "Invalid staff seat price" }, { status: 400 });
    }

    const successUrl = `${process.env.NEXTAUTH_URL}/dashboard/staff?success=true`;
    const cancelUrl = `${process.env.NEXTAUTH_URL}/dashboard/staff?canceled=true`;

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
      customer_email: ownerEmail,
      metadata: {
        purpose: "STAFF_SEAT",
        packageType: "staff_seat",
        description: "Staff Seat",
        userId: ownerId,
      },
    });

    return NextResponse.json({ requiresPayment: true, checkoutUrl: stripeSession.url });
  } catch (error) {
    console.error("[/api/staff/add] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

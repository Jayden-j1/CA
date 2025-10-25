// app/api/staff/add/route.ts
//
// Patch summary (server-side only; no client changes):
// ----------------------------------------------------
// 1) Validate that the candidate staff email domain is NOT a public mailbox
//    (gmail/outlook/etc.) using lib/email/corporate.ts.
// 2) Validate that the candidate staff email domain matches the *business email domain*
//    we return via /api/business/domain (or owner's email host as a fallback).
//
// Result:
// - No more "@gmail.com" staff.
// - The error message now references a clean, human-visible domain (e.g. "@health.com"),
//   never the internal Business.domain handle.
//
// All other behavior remains unchanged.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import { extractEmailDomain, isPublicMailboxDomain } from "@/lib/email/corporate";

//  No apiVersion to avoid type mismatch
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  // 1️ Ensure user is logged in
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2️ Only business owners can add staff
  if (session.user.role !== "BUSINESS_OWNER") {
    return NextResponse.json({ error: "Only business owners can add staff" }, { status: 403 });
  }

  try {
    const { pricePerStaff, email } = await req.json();

    // 🔒 New server-side checks (vendor + company domain)
    const candidateDomain = extractEmailDomain(email || "");
    if (!candidateDomain) {
      return NextResponse.json({ error: "Invalid staff email" }, { status: 400 });
    }
    if (isPublicMailboxDomain(candidateDomain)) {
      return NextResponse.json({ error: "Personal mailbox domains are not allowed for staff" }, { status: 400 });
    }

    // Resolve the business's human-visible email domain
    const businessId = session.user.businessId!;
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        emailDomain: true,
        owner: { select: { email: true } },
      },
    });

    // Determine effective company domain: prefer stored emailDomain; else owner's email host
    const companyDomain =
      business?.emailDomain || extractEmailDomain(business?.owner?.email || "") || null;

    if (!companyDomain) {
      return NextResponse.json(
        { error: "Business email domain not set. Please contact support." },
        { status: 400 }
      );
    }

    // Must match the company domain exactly or a subdomain of it
    const matchesCompanyDomain =
      candidateDomain === companyDomain || candidateDomain.endsWith("." + companyDomain);

    if (!matchesCompanyDomain) {
      // Provide a clean hint like "@health.com" (never expose the internal handle)
      return NextResponse.json(
        { error: `Email must use your company domain: @${companyDomain}` },
        { status: 400 }
      );
    }

    // 3️ Count how many staff users this business has
    const staffCount = await prisma.user.count({
      where: { businessId, role: "USER" },
    });

    const freeStaffLimit = 1; // how many free staff you allow

    // 4️ If still under the free limit → no payment needed
    if (staffCount < freeStaffLimit) {
      return NextResponse.json({ requiresPayment: false });
    }

    // 5️ Otherwise, create a Stripe checkout session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: { name: "Add Staff Member" },
            unit_amount: Math.round(pricePerStaff * 100), // in cents
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/dashboard/staff?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/staff?canceled=true`,
      metadata: { userId: session.user.id, purpose: "STAFF_SEAT", description: "Staff Seat" },
    });

    return NextResponse.json({ requiresPayment: true, url: stripeSession.url });
  } catch (error) {
    console.error("Payment check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// app/api/payments/check/route.ts
//
// Purpose:
// - Return { hasAccess: boolean } for the *current* user.
// - This is a tiny, fast, reliable probe used by the navbar, dashboard,
//   and now the billing page to eliminate timing races after Stripe returns.
//
// Rules:
// - ADMIN → true
// - BUSINESS_OWNER → true
// - USER (individual; businessId == null) → user.hasPaid
// - USER (staff; businessId != null) → whether the *owner* of that business has paid
//
// Why owner.hasPaid for staff?
// - Staff access is a benefit of the business package, which the owner buys.
// - We flip owner.hasPaid=true when the webhook sees a PACKAGE purchase (see webhook).
//
// Pillars:
// - Efficiency  : one small query, sometimes two.
// - Robustness  : handles every role.
// - Simplicity  : a single boolean.
// - Security    : requires authenticated session.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user?.id) {
    return NextResponse.json({ hasAccess: false }, { status: 401 });
  }

  const role = user.role as "USER" | "BUSINESS_OWNER" | "ADMIN";
  const businessId = user.businessId || null;

  // Admins always have access
  if (role === "ADMIN") {
    return NextResponse.json({ hasAccess: true });
  }

  // Business owners always have access (they purchase the package for the business)
  if (role === "BUSINESS_OWNER") {
    return NextResponse.json({ hasAccess: true });
  }

  // From here on, role === "USER"
  // Individuals (no business) → depend on their own hasPaid
  if (!businessId) {
    // Re-read from DB to be fully authoritative
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { hasPaid: true },
    });
    return NextResponse.json({ hasAccess: Boolean(dbUser?.hasPaid) });
  }

  // Staff seat (role USER + has businessId):
  // Check if the *owner* of this business has paid.
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ownerId: true },
  });
  if (!business?.ownerId) {
    return NextResponse.json({ hasAccess: false });
  }

  const owner = await prisma.user.findUnique({
    where: { id: business.ownerId },
    select: { hasPaid: true },
  });

  return NextResponse.json({ hasAccess: Boolean(owner?.hasPaid) });
}

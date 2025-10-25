// app/api/payments/check/route.ts
//
// Purpose
// -------
// Authoritatively determine whether the current user (of any role)
// should have access to paid content.
//
// Rules
// 1. ADMIN and BUSINESS_OWNER → always has access.
// 2. STAFF (role=USER + businessId ≠ null) → inherits access from its business owner.
// 3. INDIVIDUAL (role=USER + businessId=null) → hasPaid=true or a PACKAGE Payment (self-heal).
//
// Notes
// - Returns 200 {hasAccess:false} even when not authenticated, so the client UX stays quiet.
// - Mirrors Stripe webhook semantics (owner cascade), and heals transient races.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = session?.user?.role || "USER";

  if (!userId) {
    return NextResponse.json({ hasAccess: false }, { status: 200 });
  }

  if (role === "ADMIN" || role === "BUSINESS_OWNER") {
    return NextResponse.json({ hasAccess: true }, { status: 200 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hasPaid: true, businessId: true },
  });

  if (!user) {
    return NextResponse.json({ hasAccess: false }, { status: 200 });
  }

  // Staff-seat: inherit owner’s access
  if (user.businessId) {
    const owner = await prisma.user.findFirst({
      where: { id: user.businessId, role: "BUSINESS_OWNER" },
      select: { hasPaid: true },
    });

    if (owner?.hasPaid) {
      return NextResponse.json(
        { hasAccess: true, inheritedFrom: "business" },
        { status: 200 }
      );
    }
    return NextResponse.json({ hasAccess: false }, { status: 200 });
  }

  // Individual: own hasPaid
  if (user.hasPaid) {
    return NextResponse.json({ hasAccess: true }, { status: 200 });
  }

  // Self-heal: detect PACKAGE payment; set hasPaid for future requests
  const anyPackagePayment = await prisma.payment.findFirst({
    where: { userId, purpose: "PACKAGE" },
    select: { id: true },
  });

  if (anyPackagePayment) {
    await prisma.user.update({
      where: { id: userId },
      data: { hasPaid: true },
    });
    return NextResponse.json({ hasAccess: true, healed: true }, { status: 200 });
  }

  return NextResponse.json({ hasAccess: false }, { status: 200 });
}

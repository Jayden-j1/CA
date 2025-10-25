// app/api/payments/check/route.ts
//
// Purpose
// -------
// Authoritatively determine whether the current user (of any role)
// should have access to paid content (e.g., Map/Course pages).
//
// What’s improved here
// --------------------
// • Keeps your original rules and shape
// • Returns 200 {hasAccess:false} for unauthenticated callers (cleaner client UX)
// • Idempotent “self-heal” for individuals if a PACKAGE payment exists
//
// Key Rules
// ----------
// 1. ADMIN and BUSINESS_OWNER → always has access.
// 2. STAFF (role=USER + businessId ≠ null) → inherits access from its business owner.
// 3. INDIVIDUAL (role=USER + businessId=null) → must have hasPaid = true
//    OR an existing PACKAGE Payment (self-heal case).
//
// Pillars
// --------
// ✅ Efficiency: minimal queries.
// ✅ Robustness: self-heal + inherited access match webhook semantics.
// ✅ Simplicity: linear control flow.
// ✅ Ease of mgmt: single endpoint for all paid access.
// ✅ Security: never trust client; read from DB.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = session?.user?.role || "USER";

  // No session → treat as no access (200). Simpler client behavior.
  if (!userId) {
    return NextResponse.json({ hasAccess: false }, { status: 200 });
  }

  // Admin & Owner: always allowed
  if (role === "ADMIN" || role === "BUSINESS_OWNER") {
    return NextResponse.json({ hasAccess: true }, { status: 200 });
  }

  // Staff or Individual
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hasPaid: true, businessId: true },
  });

  if (!user) {
    return NextResponse.json({ hasAccess: false }, { status: 200 });
  }

  // Staff-seat: inherit from owner (owner id stored in businessId)
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

  // Self-heal: if a PACKAGE payment exists, mark hasPaid=true
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

  // Default: no access
  return NextResponse.json({ hasAccess: false }, { status: 200 });
}

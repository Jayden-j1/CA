// app/api/payments/check/route.ts
//
// Purpose
// -------
// Authoritatively determine whether the current user (of any role)
// should have access to paid content (e.g., Map/Course pages).
//
// Key Rules
// ----------
// 1. ADMIN and BUSINESS_OWNER → always has access.
// 2. STAFF (role=USER + businessId ≠ null) → inherits access from its business owner.
// 3. INDIVIDUAL (role=USER + businessId=null) → must have hasPaid = true
//    OR an existing PACKAGE Payment (self-heal case).
//
// Security
// --------
// - Uses server-side session verification (NextAuth).
// - Never trusts client claims (e.g., hasPaid).
// - Returns minimal surface info: only access-related fields.
//
// Pillars
// --------
// ✅ Efficiency: minimal queries, conditional joins.
// ✅ Robustness: self-heals timing gaps, handles missing edge cases.
// ✅ Simplicity: linear flow, clear hierarchy by role.
// ✅ Ease of management: single endpoint for all paid access.
// ✅ Security: safe read/update ops, no client trust.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // 1️⃣ Get the current user session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // No active session → deny access
    return NextResponse.json({ hasAccess: false }, { status: 401 });
  }

  const userId = session.user.id;
  const role = session.user.role || "USER";

  // 2️⃣ Admins and Business Owners always have access
  if (role === "ADMIN" || role === "BUSINESS_OWNER") {
    return NextResponse.json({ hasAccess: true }, { status: 200 });
  }

  // 3️⃣ Fetch key data for regular users (may be staff or individuals)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      hasPaid: true,
      businessId: true, // null for individuals
    },
  });

  if (!user) {
    return NextResponse.json({ hasAccess: false }, { status: 404 });
  }

  // -------------------------------------------------------------
  // 🧩 Staff-seat logic (inherits access from business owner)
  // -------------------------------------------------------------
  if (user.businessId) {
    // Find parent business (BUSINESS_OWNER user)
    const businessOwner = await prisma.user.findFirst({
      where: {
        id: user.businessId,
        role: "BUSINESS_OWNER",
      },
      select: { hasPaid: true },
    });

    // If the owner has paid, the staff inherits access
    if (businessOwner?.hasPaid) {
      return NextResponse.json(
        {
          hasAccess: true,
          inheritedFrom: "business",
        },
        { status: 200 }
      );
    }

    // If the business owner hasn't paid, no inherited access
    return NextResponse.json({ hasAccess: false }, { status: 200 });
  }

  // -------------------------------------------------------------
  // 🧩 Individual logic (independent users)
  // -------------------------------------------------------------
  if (user.hasPaid) {
    return NextResponse.json({ hasAccess: true }, { status: 200 });
  }

  // Self-heal path: user has at least one PACKAGE Payment in DB
  const anyPayment = await prisma.payment.findFirst({
    where: { userId, purpose: "PACKAGE" },
    select: { id: true },
  });

  if (anyPayment) {
    await prisma.user.update({
      where: { id: userId },
      data: { hasPaid: true },
    });

    return NextResponse.json(
      { hasAccess: true, healed: true },
      { status: 200 }
    );
  }

  // -------------------------------------------------------------
  // 🚫 Default: no valid payment or inheritance detected
  // -------------------------------------------------------------
  return NextResponse.json({ hasAccess: false }, { status: 200 });
}

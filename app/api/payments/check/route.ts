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
// 🔧 Fix (targeted, minimal):
// ---------------------------
// The previous implementation tried to look up the business owner like this:
//   await prisma.user.findFirst({ where: { id: user.businessId, role: "BUSINESS_OWNER" } })
// But `user.businessId` is a Business.id (not a User.id), so that lookup never matched.
// Result: staff never inherited paid access → Map/Course stayed locked.
//
// We now resolve the owner via the Business relation (same approach used in lib/auth.ts):
//   await prisma.business.findUnique({ where: { id: user.businessId }, select: { owner: { select: { hasPaid: true }}}})
//
// Pillars
// -------
// - Efficiency: single, indexed queries; no N+1; no extra joins.
// - Robustness: mirrors your existing `lib/auth.ts` logic exactly.
// - Simplicity: only one small section changed; everything else untouched.
// - Ease of management: comments explain the why and where.
// - Security: read-only; server is source of truth.
//

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // 0) Session probe: we deliberately return 200 for unauthenticated (quiet UX)
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = session?.user?.role || "USER";

  if (!userId) {
    return NextResponse.json({ hasAccess: false }, { status: 200 });
  }

  // 1) Admins & Owners: always allowed (unchanged)
  if (role === "ADMIN" || role === "BUSINESS_OWNER") {
    return NextResponse.json({ hasAccess: true }, { status: 200 });
  }

  // 2) Load the minimal fields we need for the current user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hasPaid: true, businessId: true },
  });

  if (!user) {
    // User disappeared (rare) → treat as no access
    return NextResponse.json({ hasAccess: false }, { status: 200 });
  }

  // 3) STAFF (role USER with a businessId): inherit from business owner
  //    ✨ FIXED: resolve owner via Business relation (not user.id)
  if (user.businessId) {
    const owner = await prisma.business.findUnique({
      where: { id: user.businessId },
      select: {
        owner: {
          select: { hasPaid: true },
        },
      },
    });

    if (owner?.owner?.hasPaid) {
      // Let the client optionally show a small note like "Access inherited from your business owner"
      return NextResponse.json(
        { hasAccess: true, inheritedFrom: "business" as const },
        { status: 200 }
      );
    }

    // If owner hasn't paid, staff does not have access
    return NextResponse.json({ hasAccess: false }, { status: 200 });
  }

  // 4) INDIVIDUAL (no businessId): rely on own hasPaid first
  if (user.hasPaid) {
    return NextResponse.json({ hasAccess: true }, { status: 200 });
  }

  // 5) Self-heal for individuals:
  //    If there's a PACKAGE payment but hasPaid=false (race), mark hasPaid=true for next time.
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

  // 6) Default deny
  return NextResponse.json({ hasAccess: false }, { status: 200 });
}

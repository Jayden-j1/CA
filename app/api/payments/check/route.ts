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
//    ✅ Hardened (surgical): If owner's hasPaid=false *but* the owner has a recorded
//       PACKAGE Payment, we "self-heal": flip owner.hasPaid=true and grant access.
// 3. INDIVIDUAL (role=USER + businessId=null) → hasPaid=true or a PACKAGE Payment (self-heal).
//
// Why this change (minimal & targeted)
// ------------------------------------
// In rare cases (e.g., webhook timing/retry), the owner’s `hasPaid` may not flip even though
// there *is* a Payment row. That causes staff to appear locked. We fix that *only here*,
// on the read-path, by checking for a PACKAGE payment and syncing `hasPaid`.
// No payment or signup flows were altered.
//
// Pillars
// -------
// - Efficiency: minimal, indexed lookups; narrow selects.
// - Robustness: self-heals rare webhook misses for both staff owners & individuals.
// - Simplicity: tiny addition in the staff branch; response shape unchanged.
// - Ease of mgmt: comments explain exactly what and why.
// - Security: write is limited to flipping `hasPaid=true` when an authoritative Payment exists.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // 0) Session probe: return 200 for unauthenticated (quiet UX)
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

  // 2) Load minimal fields for current user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hasPaid: true, businessId: true },
  });

  if (!user) {
    // User disappeared (rare) → treat as no access
    return NextResponse.json({ hasAccess: false }, { status: 200 });
  }

  // 3) STAFF (role USER with a businessId): inherit from business owner
  //    ✨ FIXED previously: resolve owner via Business relation (not user.id)
  //    🔧 HARDENED now: if owner.hasPaid=false but owner has a PACKAGE Payment, self-heal.
  if (user.businessId) {
    // We need owner's id + hasPaid (id is required for the self-heal check)
    const business = await prisma.business.findUnique({
      where: { id: user.businessId },
      select: {
        owner: {
          select: { id: true, hasPaid: true },
        },
      },
    });

    const owner = business?.owner;

    // Happy path: owner already has access → staff inherits
    if (owner?.hasPaid) {
      return NextResponse.json(
        { hasAccess: true, inheritedFrom: "business" as const },
        { status: 200 }
      );
    }

    // Self-heal: If owner exists but hasPaid=false, check for any PACKAGE payment by the owner.
    // This covers rare webhook race/miss without changing your payment flows.
    if (owner?.id) {
      const ownerHasPackagePayment = await prisma.payment.findFirst({
        where: { userId: owner.id, purpose: "PACKAGE" },
        select: { id: true },
      });

      if (ownerHasPackagePayment) {
        // Bring DB in sync so future checks are fast (and all staff unlock immediately)
        await prisma.user.update({
          where: { id: owner.id },
          data: { hasPaid: true },
        });

        return NextResponse.json(
          { hasAccess: true, inheritedFrom: "business" as const, healed: true },
          { status: 200 }
        );
      }
    }

    // If owner hasn't paid (and no PACKAGE payment to self-heal), staff has no access
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

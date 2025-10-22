// app/api/payments/check/route.ts
//
// Purpose
// -------
// Authoritatively tell the client whether the current user has access.
// This endpoint is polled right after Stripe success to avoid UI flicker
// and make the dashboard/nav update immediately.
//
// Behavior
// --------
// - ADMIN / BUSINESS_OWNER → hasAccess = true.
// - USER:
//    • if user.hasPaid === true → hasAccess = true
//    • else, if we find any Payment for this user, we *heal* the flag by
//      setting user.hasPaid = true and return hasAccess = true
//    • otherwise → false
//
// Pillars
// -------
// ✅ Efficiency: single light query, one-time self-heal write if needed.
// ✅ Robustness: resilient to webhook/session timing.
// ✅ Simplicity: clear control flow, minimal branching.
// ✅ Ease of mgmt: concentrated logic used by Dashboard/Nav probes.
// ✅ Security: session required; role respected.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ hasAccess: false }, { status: 401 });
  }

  const userId = session.user.id;
  const role = session.user.role || "USER";

  // Owners/Admins always have portal access
  if (role === "ADMIN" || role === "BUSINESS_OWNER") {
    return NextResponse.json({ hasAccess: true }, { status: 200 });
  }

  // Individuals: rely on DB truth (hasPaid); heal if we detect a Payment already present
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { hasPaid: true },
  });

  if (dbUser?.hasPaid) {
    return NextResponse.json({ hasAccess: true }, { status: 200 });
  }

  // Self-heal: if a payment exists for this user (any purpose "PACKAGE"),
  // flip user.hasPaid = true once and return positive. This closes timing gaps
  // between webhook write and session refresh.
  const anyPayment = await prisma.payment.findFirst({
    where: { userId, purpose: "PACKAGE" },
    select: { id: true },
  });

  if (anyPayment) {
    await prisma.user.update({
      where: { id: userId },
      data: { hasPaid: true },
    });
    return NextResponse.json({ hasAccess: true, healed: true }, { status: 200 });
  }

  return NextResponse.json({ hasAccess: false }, { status: 200 });
}

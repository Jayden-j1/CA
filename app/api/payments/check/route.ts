// app/api/payments/check/route.ts
//
// Purpose:
// - Tell the frontend whether the logged-in user has at least 1 valid payment.
// - Used by /dashboard/map and /dashboard/course to gate access.
// - Returns { hasAccess: true/false }.
//
// Notes:
// - This avoids duplicating Prisma logic in multiple frontend pages.
// - Middleware ensures only logged-in users can call this route,
//   but we still double-check the session here for safety.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // ------------------------------
  // 1. Validate session
  // ------------------------------
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    // 🚫 No user logged in → no access
    return NextResponse.json({ hasAccess: false }, { status: 401 });
  }

  try {
    // ------------------------------
    // 2. Query payments table
    // ------------------------------
    // Look for ANY payment record tied to this user.
    // This works for:
    // - Direct individual purchases
    // - Business owners
    // - Staff added by a business (if paid for)
    const payment = await prisma.payment.findFirst({
      where: { userId: session.user.id },
    });

    // ------------------------------
    // 3. Return result
    // ------------------------------
    // If a payment exists, grant access.
    return NextResponse.json({ hasAccess: !!payment });
  } catch (err) {
    // ------------------------------
    // 4. Handle errors gracefully
    // ------------------------------
    console.error("[API] Payment check error:", err);
    return NextResponse.json({ hasAccess: false }, { status: 500 });
  }
}

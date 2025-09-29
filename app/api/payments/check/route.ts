// app/api/payments/check/route.ts
//
// Purpose:
// - API endpoint for frontend gating (map, course, nav).
// - Returns true if user has PACKAGE or STAFF_SEAT payment, but only if user isActive.
// - Prevents soft-deleted (inactive) users from accessing content.
//
// Behavior:
// - PACKAGE → packageType = "individual" | "business"
// - STAFF_SEAT → packageType = "business" (staff seats are business access)
// - Inactive user → always hasAccess = false
// - No payment → hasAccess = false
//
// Response:
// { hasAccess, packageType, latestPayment }

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // ---------------------------
  // 1) Validate session
  // ---------------------------
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { hasAccess: false, packageType: null, latestPayment: null },
      { status: 401 }
    );
  }

  try {
    // ---------------------------
    // 2) Fetch user and check active status
    // ---------------------------
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isActive: true },
    });

    if (!user || user.isActive === false) {
      // 🚩 If user is inactive, deny access regardless of payments
      return NextResponse.json({
        hasAccess: false,
        packageType: null,
        latestPayment: null,
      });
    }

    // ---------------------------
    // 3) PACKAGE check
    // ---------------------------
    const packagePayment = await prisma.payment.findFirst({
      where: { userId: session.user.id, purpose: "PACKAGE" },
      orderBy: { createdAt: "desc" },
    });

    if (packagePayment) {
      let packageType: "individual" | "business" | null = null;
      const desc = packagePayment.description.toLowerCase();
      if (desc.includes("individual")) packageType = "individual";
      else if (desc.includes("business")) packageType = "business";

      return NextResponse.json({
        hasAccess: true,
        packageType,
        latestPayment: {
          id: packagePayment.id,
          createdAt: packagePayment.createdAt,
          amount: packagePayment.amount,
        },
      });
    }

    // ---------------------------
    // 4) STAFF_SEAT check
    // ---------------------------
    const staffSeatPayment = await prisma.payment.findFirst({
      where: { userId: session.user.id, purpose: "STAFF_SEAT" },
      orderBy: { createdAt: "desc" },
    });

    if (staffSeatPayment) {
      return NextResponse.json({
        hasAccess: true,
        packageType: "business",
        latestPayment: {
          id: staffSeatPayment.id,
          createdAt: staffSeatPayment.createdAt,
          amount: staffSeatPayment.amount,
        },
      });
    }

    // ---------------------------
    // 5) No access
    // ---------------------------
    return NextResponse.json({
      hasAccess: false,
      packageType: null,
      latestPayment: null,
    });
  } catch (err) {
    console.error("[API] Payment check error:", err);
    return NextResponse.json(
      { hasAccess: false, packageType: null, latestPayment: null },
      { status: 500 }
    );
  }
}

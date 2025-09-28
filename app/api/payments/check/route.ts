// app/api/payments/check/route.ts
//
// Purpose:
// - Tell the frontend whether the logged-in user has access.
// - Previously: Only PACKAGE payments unlocked access.
// - NEW: Also allow STAFF_SEAT payments (for staff added by a business owner).
//
// Behavior:
// - If user has a PACKAGE payment → hasAccess = true + infer packageType for display.
// - Else if user has a STAFF_SEAT payment → hasAccess = true + packageType = "business"
//   (because a staff seat is a business-provided access)
// - Else → hasAccess = false.
//
// Response Shape:
// {
//   hasAccess: boolean,
//   packageType: "individual" | "business" | null,
//   latestPayment: { id: string; createdAt: string; amount: number } | null
// }
//
// Notes:
// - We assume the staff-seat payment is saved with `userId = staff.id`.
// - If you later extend Payment with businessId, you could accept
//   business-wide seats too by checking `where: { businessId: user.businessId }`.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // 1) Confirm session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { hasAccess: false, packageType: null, latestPayment: null },
      { status: 401 }
    );
  }

  try {
    // 2) First try to find the most recent PACKAGE payment for this user
    const packagePayment = await prisma.payment.findFirst({
      where: { userId: session.user.id, purpose: "PACKAGE" },
      orderBy: { createdAt: "desc" },
    });

    if (packagePayment) {
      // Infer package type from description
      let packageType: "individual" | "business" | null = null;
      const desc = packagePayment.description.toLowerCase();
      if (desc.includes("individual")) {
        packageType = "individual";
      } else if (desc.includes("business")) {
        packageType = "business";
      }

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

    // 3) If no PACKAGE payment, check for a STAFF_SEAT payment for *this user*
    //    This covers the "paid staff" case where the payment is saved with
    //    userId = staff.id (the staff account).
    const staffSeatPayment = await prisma.payment.findFirst({
      where: { userId: session.user.id, purpose: "STAFF_SEAT" },
      orderBy: { createdAt: "desc" },
    });

    if (staffSeatPayment) {
      // For UX consistency, treat staff-seat access as "business" access.
      // That way, dashboard sections can show "You are on the business package".
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

    // 4) No applicable payments → no access
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

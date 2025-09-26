// app/api/payments/check/route.ts
//
// Purpose:
// - Tell the frontend whether the logged-in user has access based on PACKAGE purchases.
// - Ignores STAFF_SEAT payments (those don’t unlock course access).
// - Returns latest PACKAGE payment with type inference.
//
// Response Shape:
// {
//   hasAccess: boolean,
//   packageType: "individual" | "business" | null,
//   latestPayment: { id: string; createdAt: string; amount: number } | null
// }

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // 1. Validate session
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { hasAccess: false, packageType: null, latestPayment: null },
      { status: 401 }
    );
  }

  try {
    // 2. Find the most recent *PACKAGE* payment for this user
    const payment = await prisma.payment.findFirst({
      where: {
        userId: session.user.id,
        purpose: "PACKAGE", // ✅ Only consider package payments
      },
      orderBy: { createdAt: "desc" },
    });

    // 3. If no package payment → no access
    if (!payment) {
      return NextResponse.json({
        hasAccess: false,
        packageType: null,
        latestPayment: null,
      });
    }

    // 4. Infer package type from description
    let packageType: "individual" | "business" | null = null;
    if (payment.description.toLowerCase().includes("individual")) {
      packageType = "individual";
    } else if (payment.description.toLowerCase().includes("business")) {
      packageType = "business";
    }

    // 5. Return structured response
    return NextResponse.json({
      hasAccess: true,
      packageType,
      latestPayment: {
        id: payment.id,
        createdAt: payment.createdAt,
        amount: payment.amount,
      },
    });
  } catch (err) {
    console.error("[API] Payment check error:", err);
    return NextResponse.json(
      { hasAccess: false, packageType: null, latestPayment: null },
      { status: 500 }
    );
  }
}

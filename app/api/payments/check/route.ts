// app/api/payments/check/route.ts
//
// Purpose:
// - Tell the frontend whether the logged-in user has at least 1 valid payment.
// - Returns richer data for dashboards, including latest payment details.
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
    // 2. Look for the most recent payment for this user
    const payment = await prisma.payment.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!payment) {
      return NextResponse.json({
        hasAccess: false,
        packageType: null,
        latestPayment: null,
      });
    }

    // 3. Infer package type from description
    let packageType: "individual" | "business" | null = null;
    if (payment.description.toLowerCase().includes("individual")) {
      packageType = "individual";
    } else if (payment.description.toLowerCase().includes("business")) {
      packageType = "business";
    }

    // 4. Return structured response with latest payment info
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

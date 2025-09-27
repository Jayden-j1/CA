// app/api/payments/check/route.ts
//
// Purpose:
// - Return whether logged-in user has PACKAGE access.
// - Ignores STAFF_SEAT payments (those don’t unlock courses).
// - Returns package type + latest payment info.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { hasAccess: false, packageType: null, latestPayment: null },
      { status: 401 }
    );
  }

  try {
    // Most recent PACKAGE payment
    const payment = await prisma.payment.findFirst({
      where: { userId: session.user.id, purpose: "PACKAGE" },
      orderBy: { createdAt: "desc" },
    });

    if (!payment) {
      return NextResponse.json({
        hasAccess: false,
        packageType: null,
        latestPayment: null,
      });
    }

    // Infer package type
    let packageType: "individual" | "business" | null = null;
    if (payment.description.toLowerCase().includes("individual")) {
      packageType = "individual";
    } else if (payment.description.toLowerCase().includes("business")) {
      packageType = "business";
    }

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

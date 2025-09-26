// app/api/payments/history/route.ts
//
// Purpose:
// - Return payment history for the billing dashboard.
// - ADMIN → return ALL payments across all users.
// - USER / BUSINESS_OWNER → only their own payments.
// - Always include `purpose` field so frontend can show PACKAGE vs STAFF_SEAT.
//
// Updates in this version:
// - Select + return purpose field.
// - Include user details for ADMIN queries.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // 1. Ensure logged-in user
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let payments;

    if (session.user.role === "ADMIN") {
      // ✅ Admin → all payments across platform
      payments = await prisma.payment.findMany({
        include: {
          user: { select: { email: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // ✅ USER / BUSINESS_OWNER → only their own
      payments = await prisma.payment.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
      });
    }

    // 2. Return as JSON — frontend now gets purpose as well
    return NextResponse.json({ payments });
  } catch (err) {
    console.error("[API] Payment history error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

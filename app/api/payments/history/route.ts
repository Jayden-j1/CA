// app/api/payments/history/route.ts
//
// Purpose:
// - Return filtered payment history for the billing dashboard.
// - ADMIN → can view ALL users' payments (with optional filters).
// - USER / BUSINESS_OWNER → only their own payments (filters still apply but restricted to their data).
//
// New Features:
// - Accept query params `purpose` and `user` for server-side filtering.
// - `purpose` must be "PACKAGE" or "STAFF_SEAT".
// - `user` is an email string (only valid for ADMIN role).
// - Prisma now does filtering at DB level → better scalability & efficiency.
//
// Example Requests:
//   /api/payments/history
//   /api/payments/history?purpose=STAFF_SEAT
//   /api/payments/history?purpose=PACKAGE&user=alice@company.com

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  // 1. Ensure user session is valid
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Parse query params from URL
    const { searchParams } = new URL(req.url);
    const purposeParam = searchParams.get("purpose"); // "PACKAGE" | "STAFF_SEAT"
    const userEmailParam = searchParams.get("user"); // email string

    // 3. Build base filter
    const whereClause: any = {};

    // ✅ Purpose filter (only allow known enum values)
    if (purposeParam === "PACKAGE" || purposeParam === "STAFF_SEAT") {
      whereClause.purpose = purposeParam;
    }

    // 4. Role-based access
    let payments;

    if (session.user.role === "ADMIN") {
      // ✅ Admin → see all payments, optionally filtered by user email
      if (userEmailParam) {
        // If a specific user email is requested
        whereClause.user = { email: userEmailParam };
      }

      payments = await prisma.payment.findMany({
        where: whereClause,
        include: {
          user: { select: { email: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // ✅ USER / BUSINESS_OWNER → only their own payments
      whereClause.userId = session.user.id;

      payments = await prisma.payment.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      });
    }

    // 5. Return payments
    return NextResponse.json({ payments });
  } catch (err) {
    console.error("[API] Payment history error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

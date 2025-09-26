// app/api/payments/history/route.ts
//
// Purpose:
// - Return filtered payment history for the billing dashboard.
// - Admins: can view ALL users' payments and also receive a separate list of distinct users.
// - Non-admins: restricted to their own payments.
// - Accepts query params for server-side filtering.
//
// Features:
// - Query params:
//   - ?purpose=PACKAGE | STAFF_SEAT
//   - ?user=<userEmail> (admins only)
// - Returns: { payments, users? } where `users` is only included for admins.
//
// Example:
//   /api/payments/history
//   /api/payments/history?purpose=STAFF_SEAT
//   /api/payments/history?purpose=PACKAGE&user=alice@company.com
//
// Notes:
// - Filtering is done in Prisma (server-side) for efficiency.
// - Distinct user list is built separately to power dropdowns in UI.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  // 1. Ensure the user is authenticated
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Parse query parameters
    const { searchParams } = new URL(req.url);
    const purposeParam = searchParams.get("purpose"); // "PACKAGE" | "STAFF_SEAT"
    const userEmailParam = searchParams.get("user"); // specific user email

    // 3. Start building the Prisma `where` clause
    const whereClause: any = {};

    // ✅ Filter by purpose (if valid)
    if (purposeParam === "PACKAGE" || purposeParam === "STAFF_SEAT") {
      whereClause.purpose = purposeParam;
    }

    let payments;
    let users; // optional extra array for admins

    // 4. Role-based logic
    if (session.user.role === "ADMIN") {
      // ✅ Admin → can view all users’ payments

      if (userEmailParam) {
        // If filtering by specific user email
        whereClause.user = { email: userEmailParam };
      }

      payments = await prisma.payment.findMany({
        where: whereClause,
        include: {
          user: { select: { email: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      // ✅ Distinct list of users (for dropdown in UI)
      const distinctUsers = await prisma.user.findMany({
        where: {
          payments: { some: {} }, // only users who have payments
        },
        select: {
          email: true,
          name: true,
        },
        orderBy: { email: "asc" },
      });

      users = distinctUsers;
    } else {
      // ✅ USER / BUSINESS_OWNER → only their own payments
      whereClause.userId = session.user.id;

      payments = await prisma.payment.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      });
    }

    // 5. Return response
    return NextResponse.json({ payments, users });
  } catch (err) {
    console.error("[API] Payment history error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

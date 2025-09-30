// app/api/payments/history/route.ts
//
// Purpose:
// - Return filtered payment history for the billing dashboard.
// - Strictly enforce access rules to match the Billing page guard:
//   • ADMIN → can see all payments.
//   • BUSINESS_OWNER → can see all payments for their business (owner + staff).
//   • USER →
//       - If staff-seat (businessId != null) → FORBIDDEN (403).
//       - If individual (businessId == null) and hasPaid === true → own payments only.
//       - Else → FORBIDDEN (403).
//
// Query params:
// - ?purpose=PACKAGE | STAFF_SEAT
// - ?user=<userEmail> (allowed for ADMIN + BUSINESS_OWNER; ignored for USER)
//
// Response:
// - { payments, users? } → users (distinct) only for ADMIN/BUSINESS_OWNER for UI dropdown.
//
// Notes:
// - Prisma model Payment has only userId relation; to fetch "business-wide" data we filter by:
//     where: { user: { businessId: <ownerBusinessId> } }
// - We include `user` details for ADMIN + BUSINESS_OWNER so the UI can show "User" column.
//   Individual USER sees only their own payments and doesn't need the extra user object.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  // 1) Require authenticated session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Extract role + ownership flags from session
  const role = session.user.role;
  const userId = session.user.id;
  const businessId = session.user.businessId || null;
  const hasPaid = Boolean(session.user.hasPaid);

  try {
    // 3) Parse query parameters
    const { searchParams } = new URL(req.url);
    const purposeParam = searchParams.get("purpose"); // "PACKAGE" | "STAFF_SEAT" or null
    const userEmailParam = searchParams.get("user");  // user's email or null

    // 4) Common where clause seeded by purpose (if valid)
    const baseWhere: any = {};
    if (purposeParam === "PACKAGE" || purposeParam === "STAFF_SEAT") {
      baseWhere.purpose = purposeParam;
    }

    // We’ll populate `payments` and (optionally) `users` (for dropdown)
    let payments: any[] = [];
    let users: { email: string; name: string | null }[] | undefined;

    // ============================================================
    // ADMIN
    // - Full access across all businesses/users.
    // - Optional ?user filter by email.
    // - Include user in the result so UI shows the "User" column.
    // - Return distinct users for dropdown.
    // ============================================================
    if (role === "ADMIN") {
      const whereClause: any = { ...baseWhere };

      if (userEmailParam) {
        // Filter by nested user using email
        whereClause.user = { email: userEmailParam };
      }

      payments = await prisma.payment.findMany({
        where: whereClause,
        include: {
          user: { select: { email: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      // Distinct users who have any payment
      users = await prisma.user.findMany({
        where: {
          payments: { some: {} }, // at least one payment
        },
        select: { email: true, name: true },
        orderBy: { email: "asc" },
      });

      return NextResponse.json({ payments, users });
    }

    // ============================================================
    // BUSINESS_OWNER
    // - Must have a businessId.
    // - Sees all payments for that business (owner + all staff).
    // - Optional ?user=email filter scoped to their business.
    // - Include user for table display.
    // - Return distinct users scoped to their business for dropdown.
    // ============================================================
    if (role === "BUSINESS_OWNER") {
      if (!businessId) {
        // Safety check: owner should always have a businessId
        return NextResponse.json({ error: "Business not found" }, { status: 400 });
      }

      const whereClause: any = {
        ...baseWhere,
        user: {
          businessId: businessId,
          ...(userEmailParam ? { email: userEmailParam } : {}),
        },
      };

      payments = await prisma.payment.findMany({
        where: whereClause,
        include: {
          user: { select: { email: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      users = await prisma.user.findMany({
        where: {
          businessId: businessId,
          payments: { some: {} }, // only users with payments inside owner’s business
        },
        select: { email: true, name: true },
        orderBy: { email: "asc" },
      });

      return NextResponse.json({ payments, users });
    }

    // ============================================================
    // USER
    // - Staff-seat user (businessId != null): FORBIDDEN.
    // - Individual user (businessId == null):
    //     Must have hasPaid === true to see Billing (API & page).
    //     Only sees their own payments.
    // ============================================================
    if (role === "USER") {
      const isStaffSeat = !!businessId;
      if (isStaffSeat) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!hasPaid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const whereClause: any = {
        ...baseWhere,
        userId: userId,
      };

      // NOTE:
      // - We don't need to include user for an individual user's own table.
      //   Frontend Billing page renders fine if user is omitted.
      payments = await prisma.payment.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ payments });
    }

    // Any unexpected role → forbid
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (err) {
    console.error("[API] Payment history error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

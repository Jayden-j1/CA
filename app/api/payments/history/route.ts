// app/api/payments/history/route.ts
//
// Purpose: unchanged (role-gated billing history).
// Tiny robustness tweak: BUSINESS_OWNER/ADMIN email filter is now case-insensitive.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  const userId = session.user.id;
  const businessId = session.user.businessId || null;
  const hasPaid = Boolean(session.user.hasPaid);

  try {
    const { searchParams } = new URL(req.url);

    const purposeRaw = searchParams.get("purpose");
    const purposeParam =
      purposeRaw && ["PACKAGE", "STAFF_SEAT"].includes(purposeRaw.toUpperCase())
        ? (purposeRaw.toUpperCase() as "PACKAGE" | "STAFF_SEAT")
        : null;

    const userEmailParam = searchParams.get("user");

    const baseWhere: any = {};
    if (purposeParam) baseWhere.purpose = purposeParam;

    let payments: any[] = [];
    let users: { email: string; name: string | null }[] | undefined;

    if (role === "ADMIN") {
      const whereClause: any = { ...baseWhere };
      if (userEmailParam) {
        whereClause.user = { email: { equals: userEmailParam, mode: "insensitive" } }; // 👈 robust
      }

      payments = await prisma.payment.findMany({
        where: whereClause,
        include: { user: { select: { email: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" },
      });

      users = await prisma.user.findMany({
        where: { payments: { some: {} } },
        select: { email: true, name: true },
        orderBy: { email: "asc" },
      });

      return NextResponse.json({ payments, users });
    }

    if (role === "BUSINESS_OWNER") {
      if (!businessId) {
        return NextResponse.json({ error: "Business not found" }, { status: 400 });
      }

      const whereClause: any = {
        ...baseWhere,
        user: {
          businessId,
          ...(userEmailParam
            ? { email: { equals: userEmailParam, mode: "insensitive" } } // 👈 robust
            : {}),
        },
      };

      payments = await prisma.payment.findMany({
        where: whereClause,
        include: { user: { select: { email: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" },
      });

      users = await prisma.user.findMany({
        where: { businessId, payments: { some: {} } },
        select: { email: true, name: true },
        orderBy: { email: "asc" },
      });

      return NextResponse.json({ payments, users });
    }

    if (role === "USER") {
      const isStaffSeat = !!businessId;
      if (isStaffSeat) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (!hasPaid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const whereClause: any = { ...baseWhere, userId };
      payments = await prisma.payment.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ payments });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (err) {
    console.error("[API] Payment history error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// app/api/staff/list/route.ts
//
// Purpose:
// - Return a list of ACTIVE staff (USER/ADMIN only).
// - BUSINESS_OWNER can only see their own staff.
// - ADMIN can see their business staff or all staff if “super admin”.
// - Includes role filter via ?role=USER|ADMIN.
// - Excludes BUSINESS_OWNER (staff = USER or ADMIN).
//
// 🚩 Updated:
// - Now only returns staff where isActive = true (soft-deletion respected).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Restrict to BUSINESS_OWNER or ADMIN
    const role = session.user.role;
    if (role !== "BUSINESS_OWNER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ------------------------------
    // Parse query params
    // ------------------------------
    const url = new URL(req.url);
    const requestedBusinessId = url.searchParams.get("businessId");
    const requestedRole = url.searchParams.get("role"); // "USER" | "ADMIN" | null

    // ------------------------------
    // Role filter (exclude BUSINESS_OWNER)
    // ------------------------------
    const roleFilter =
      requestedRole === "USER" || requestedRole === "ADMIN"
        ? { in: [requestedRole] }
        : { in: ["USER", "ADMIN"] };

    let whereClause: any;

    // ------------------------------
    // BUSINESS_OWNER → only their active staff
    // ------------------------------
    if (role === "BUSINESS_OWNER") {
      const ownerBusinessId = session.user.businessId;
      if (!ownerBusinessId) {
        return NextResponse.json(
          { error: "Business not found" },
          { status: 400 }
        );
      }
      whereClause = {
        businessId: ownerBusinessId,
        role: roleFilter,
        isActive: true, // ✅ only active staff
      };
    } else {
      // ------------------------------
      // ADMIN
      // ------------------------------
      if (requestedBusinessId) {
        whereClause = {
          businessId: requestedBusinessId,
          role: roleFilter,
          isActive: true,
        };
      } else if (session.user.businessId) {
        whereClause = {
          businessId: session.user.businessId,
          role: roleFilter,
          isActive: true,
        };
      } else {
        // Super-admin (no businessId tied)
        whereClause = {
          businessId: { not: null },
          role: roleFilter,
          isActive: true,
        };
      }
    }

    // ------------------------------
    // Fetch only ACTIVE staff
    // ------------------------------
    const staffList = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ staff: staffList });
  } catch (error) {
    console.error("Fetch staff list error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

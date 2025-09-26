// app/api/staff/list/route.ts
//
// Purpose:
// - Return a list of staff users for a business, INCLUDING each staff member's role.
// - Allows BOTH BUSINESS_OWNER and ADMIN to read the list.
// - BUSINESS_OWNER: restricted to their own business.
// - ADMIN: may pass ?businessId= to view a specific business, or list all staff if super admin.
//
// New in this version:
// - Optional role filter via ?role=USER or ?role=ADMIN (falls back to both if not provided).
// - Always excludes BUSINESS_OWNER from results (staff = USER or ADMIN).

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

    const role = session.user.role;
    if (role !== "BUSINESS_OWNER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse query params
    const url = new URL(req.url);
    const requestedBusinessId = url.searchParams.get("businessId");
    const requestedRole = url.searchParams.get("role"); // "USER" | "ADMIN" | null

    // Build role filter (exclude "BUSINESS_OWNER" from staff results)
    const roleFilter =
      requestedRole === "USER" || requestedRole === "ADMIN"
        ? { in: [requestedRole] }
        : { in: ["USER", "ADMIN"] };

    let whereClause: any;

    if (role === "BUSINESS_OWNER") {
      const ownerBusinessId = session.user.businessId;
      if (!ownerBusinessId) {
        return NextResponse.json({ error: "Business not found" }, { status: 400 });
      }
      whereClause = { businessId: ownerBusinessId, role: roleFilter };
    } else {
      // ADMIN
      if (requestedBusinessId) {
        whereClause = { businessId: requestedBusinessId, role: roleFilter };
      } else if (session.user.businessId) {
        whereClause = { businessId: session.user.businessId, role: roleFilter };
      } else {
        // Super admin (no businessId on token): list across all businesses
        whereClause = { businessId: { not: null }, role: roleFilter };
      }
    }

    const staffList = await prisma.user.findMany({
      where: whereClause,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ staff: staffList });
  } catch (error) {
    console.error("Fetch staff list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

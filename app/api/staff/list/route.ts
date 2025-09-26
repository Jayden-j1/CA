// app/api/staff/list/route.ts
//
// Purpose:
// - Return a list of staff users for a business, INCLUDING each staff member's role.
// - Now allows BOTH BUSINESS_OWNER and ADMIN to read the list.
// - BUSINESS_OWNER: always restricted to their own business.
// - ADMIN: can pass ?businessId= to view a specific business; otherwise:
//     - if admin has a businessId, we'll use it
//     - else we list all users across all businesses (role in ["USER","ADMIN"])
//
// Notes:
// - We include `role` in the response so the UI can display USER vs ADMIN.
// - We exclude BUSINESS_OWNER from the list by filtering role IN ["USER","ADMIN"].

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

    // ✅ Allow BUSINESS_OWNER and ADMIN to list staff
    if (role !== "BUSINESS_OWNER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse optional ?businessId= for ADMIN usage
    const url = new URL(req.url);
    const requestedBusinessId = url.searchParams.get("businessId");

    // Build the query "where" clause based on who is calling
    let whereClause: any;

    if (role === "BUSINESS_OWNER") {
      const ownerBusinessId = session.user.businessId;
      if (!ownerBusinessId) {
        return NextResponse.json({ error: "Business not found" }, { status: 400 });
      }
      // Only USER/ADMIN staff within the owner's business
      whereClause = {
        businessId: ownerBusinessId,
        role: { in: ["USER", "ADMIN"] },
      };
    } else {
      // role === "ADMIN"
      if (requestedBusinessId) {
        // Admin explicitly asked for a business
        whereClause = {
          businessId: requestedBusinessId,
          role: { in: ["USER", "ADMIN"] },
        };
      } else if (session.user.businessId) {
        // Admin tied to a business → default to that business
        whereClause = {
          businessId: session.user.businessId,
          role: { in: ["USER", "ADMIN"] },
        };
      } else {
        // Super admin (no businessId): list staff across all businesses
        whereClause = {
          businessId: { not: null },
          role: { in: ["USER", "ADMIN"] },
        };
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

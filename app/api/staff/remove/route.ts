// app/api/staff/remove/route.ts
//
// Purpose:
// - Allow BUSINESS_OWNER/ADMIN to remove staff from their business.
// - Implementation: simply sets staff.businessId = null.
// - Safer than deleting users (preserves payments, history, etc).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Restrict to BUSINESS_OWNER + ADMIN
    if (
      session.user.role !== "BUSINESS_OWNER" &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { staffId } = await req.json();
    if (!staffId) {
      return NextResponse.json(
        { error: "Missing staffId" },
        { status: 400 }
      );
    }

    // Fetch staff
    const staff = await prisma.user.findUnique({ where: { id: staffId } });
    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    // Business owner can only remove from their own business
    if (
      session.user.role === "BUSINESS_OWNER" &&
      staff.businessId !== session.user.businessId
    ) {
      return NextResponse.json(
        { error: "You can only remove staff from your own business" },
        { status: 403 }
      );
    }

    // Update staff: unassign from business
    await prisma.user.update({
      where: { id: staffId },
      data: { businessId: null },
    });

    return NextResponse.json({ message: "Staff removed" });
  } catch (error) {
    console.error("[API] Staff remove error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

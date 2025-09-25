// app/api/staff/remove/route.ts
//
// Purpose:
// - Allow BUSINESS_OWNER/ADMIN to permanently delete staff from their business.
// - Returns the removed staff’s email so the frontend can show a success toast.
// - Enforces strict role checks: only BUSINESS_OWNER (own business) or ADMIN can delete staff.
//
// Notes:
// - Hard delete (prisma.user.delete) is used here.
// - This is irreversible, so ensure your frontend asks for confirmation before calling.
// - Safer for production if combined with a "soft delete" pattern (e.g., archived flag).
//   But since you requested hard delete, we implement it here.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    // ---------------------------
    // 1) Verify authentication
    // ---------------------------
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ---------------------------
    // 2) Enforce roles
    // ---------------------------
    if (
      session.user.role !== "BUSINESS_OWNER" &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ---------------------------
    // 3) Parse request body
    // ---------------------------
    const { staffId } = await req.json();
    if (!staffId) {
      return NextResponse.json(
        { error: "Missing staffId" },
        { status: 400 }
      );
    }

    // ---------------------------
    // 4) Fetch staff user
    // ---------------------------
    const staff = await prisma.user.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    // ---------------------------
    // 5) Business owner restriction
    // ---------------------------
    if (
      session.user.role === "BUSINESS_OWNER" &&
      staff.businessId !== session.user.businessId
    ) {
      return NextResponse.json(
        { error: "You can only remove staff from your own business" },
        { status: 403 }
      );
    }

    // ---------------------------
    // 6) Hard delete staff
    // ---------------------------
    const deletedStaff = await prisma.user.delete({
      where: { id: staffId },
      select: { email: true }, // only return email for toast feedback
    });

    // ---------------------------
    // 7) Return success
    // ---------------------------
    return NextResponse.json({
      message: `Staff removed`,
      email: deletedStaff.email,
    });
  } catch (error) {
    console.error("[API] Staff remove error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

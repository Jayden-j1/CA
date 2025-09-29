// app/api/staff/remove/route.ts
//
// Purpose:
// - Soft delete staff by setting `isActive = false` instead of hard deleting rows.
// - Preserves Payment history and avoids FK errors (best practice for billing).
// - Only BUSINESS_OWNER (own business) or ADMIN can deactivate staff.
//
// How the frontend should behave:
// - After this call returns 200, remove the staff row from the UI immediately.
// - If you list staff anywhere, fetch only `isActive = true` users.
//
// Important:
// - Ensure your Prisma schema has `User.isActive Boolean @default(true)`
// - Then run: npx prisma migrate dev --name add_user_isActive && npx prisma generate

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    // 1) Auth required
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Role check
    if (
      session.user.role !== "BUSINESS_OWNER" &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3) Parse body
    const { staffId } = await req.json();
    if (!staffId) {
      return NextResponse.json(
        { error: "Missing staffId" },
        { status: 400 }
      );
    }

    // 4) Locate staff user
    const staff = await prisma.user.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    // 5) Enforce owner’s scope
    if (
      session.user.role === "BUSINESS_OWNER" &&
      staff.businessId !== session.user.businessId
    ) {
      return NextResponse.json(
        { error: "You can only remove staff from your own business" },
        { status: 403 }
      );
    }

    // 6) Soft delete: mark inactive (keeps Payments intact)
    //    This will compile only after running prisma migrate/generate.
    const updatedStaff = await prisma.user.update({
      where: { id: staffId },
      data: { isActive: false }, // ✅ Soft delete flag
      select: { email: true },
    });

    // 7) Success payload (used for toast messaging)
    return NextResponse.json({
      message: "Staff deactivated",
      email: updatedStaff.email,
    });
  } catch (error) {
    console.error("[API] Staff remove error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

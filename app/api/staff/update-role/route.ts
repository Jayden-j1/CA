// app/api/staff/update-role/route.ts
//
// Purpose:
// - Allows BUSINESS_OWNER or ADMIN to promote/demote staff between USER and ADMIN.
// - BUSINESS_OWNER: can only update roles of staff in their own business.
// - ADMIN: can update any staff (but not BUSINESS_OWNERs).
//
// Request (POST JSON):
//   { staffId: string, newRole: "USER" | "ADMIN" }
//
// Response (200):
//   { message: string, user: { id, email, role } }

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    // ------------------------------
    // 1. Ensure user is logged in
    // ------------------------------
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ------------------------------
    // 2. Permission check
    // ------------------------------
    if (
      session.user.role !== "BUSINESS_OWNER" &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ------------------------------
    // 3. Validate input
    // ------------------------------
    const { staffId, newRole } = await req.json();
    if (!staffId || (newRole !== "USER" && newRole !== "ADMIN")) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // ------------------------------
    // 4. Lookup target user
    // ------------------------------
    const target = await prisma.user.findUnique({
      where: { id: staffId },
      select: { id: true, email: true, role: true, businessId: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent modifying BUSINESS_OWNER accounts
    if (target.role === "BUSINESS_OWNER") {
      return NextResponse.json(
        { error: "Cannot change BUSINESS_OWNER role via this endpoint" },
        { status: 403 }
      );
    }

    // ------------------------------
    // 5. Owner-specific restriction
    // ------------------------------
    if (
      session.user.role === "BUSINESS_OWNER" &&
      target.businessId !== session.user.businessId
    ) {
      return NextResponse.json(
        { error: "You can only change roles for staff in your business" },
        { status: 403 }
      );
    }

    // ------------------------------
    // 6. Skip if no change
    // ------------------------------
    if (target.role === newRole) {
      return NextResponse.json({
        message: `No change: user already has role ${newRole}`,
        user: { id: target.id, email: target.email, role: target.role },
      });
    }

    // ------------------------------
    // 7. Update role
    // ------------------------------
    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { role: newRole },
      select: { id: true, email: true, role: true },
    });

    return NextResponse.json({
      message: `Role updated to ${newRole}`,
      user: updated,
    });
  } catch (error) {
    console.error("[API] update-role error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

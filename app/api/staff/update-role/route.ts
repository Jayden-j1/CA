// app/api/staff/update-role/route.ts
//
// Purpose:
// - Promote/demote a staff user between USER and ADMIN.
// - Enforces BUSINESS_OWNER/ADMIN permissions.
// - BUSINESS_OWNER can only change users inside their own business.
// - ADMIN can change any staff (except BUSINESS_OWNERs).
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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "BUSINESS_OWNER" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { staffId, newRole } = await req.json();
    if (!staffId || (newRole !== "USER" && newRole !== "ADMIN")) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id: staffId },
      select: { id: true, email: true, role: true, businessId: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Disallow touching owners through this endpoint
    if (target.role === "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Cannot change owner role via this endpoint" }, { status: 403 });
    }

    // Owners can only change roles within their business
    if (
      session.user.role === "BUSINESS_OWNER" &&
      target.businessId !== session.user.businessId
    ) {
      return NextResponse.json(
        { error: "You can only change roles for staff in your business" },
        { status: 403 }
      );
    }

    // Avoid unnecessary writes
    if (target.role === newRole) {
      return NextResponse.json({
        message: `No change: user already has role ${newRole}`,
        user: { id: target.id, email: target.email, role: target.role },
      });
    }

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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// app/api/staff/list/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only BUSINESS_OWNER can fetch full staff list
    if (session.user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const businessId = session.user.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "Business not found" }, { status: 400 });
    }

    const staffList = await prisma.user.findMany({
      where: { businessId, role: "USER" },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ staff: staffList });
  } catch (error) {
    console.error("Fetch staff list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

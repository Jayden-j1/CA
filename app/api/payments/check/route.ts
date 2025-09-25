// app/api/payments/check/route.ts
//
// Purpose:
// - Tell the frontend whether the logged-in user has at least 1 payment.
// - Used by /dashboard/course and /dashboard/map to gate access.
// - Returns { hasAccess: true/false }.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ hasAccess: false }, { status: 401 });
  }

  try {
    // ✅ Check if user has any payments
    const payment = await prisma.payment.findFirst({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ hasAccess: !!payment });
  } catch (err) {
    console.error("[API] Payment check error:", err);
    return NextResponse.json({ hasAccess: false }, { status: 500 });
  }
}

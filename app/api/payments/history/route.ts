// app/api/payments/history/route.ts
//
// Purpose:
// - Return payment history for the dashboard billing page.
// - If user is ADMIN → return ALL payments across the platform.
// - If user is USER or BUSINESS_OWNER → return only their own payments.
// - Protects endpoint with NextAuth session check.
//
// Notes:
// - Prisma query adapts to role automatically.
// - Payments are ordered by most recent first.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // 1. Get current session
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let payments;

    if (session.user.role === "ADMIN") {
      // ✅ Admin → fetch ALL payments
      payments = await prisma.payment.findMany({
        include: {
          user: { select: { email: true, name: true, role: true } }, // show who paid
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // ✅ Normal user → fetch only their own payments
      payments = await prisma.payment.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json({ payments });
  } catch (err) {
    console.error("[API] Payment history error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}









// // app/api/payments/history/route.ts
// //
// // Purpose:
// // - Returns ALL payment records for the logged-in user.
// // - Used by /dashboard/billing to show full history.

// import { NextResponse } from "next/server";
// import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/lib/auth";
// import { prisma } from "@/lib/prisma";

// export async function GET() {
//   const session = await getServerSession(authOptions);

//   if (!session?.user?.id) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   try {
//     const payments = await prisma.payment.findMany({
//       where: { userId: session.user.id },
//       orderBy: { createdAt: "desc" },
//     });

//     return NextResponse.json({ payments });
//   } catch (err) {
//     console.error("[API] Payments history error:", err);
//     return NextResponse.json({ error: "Internal server error" }, { status: 500 });
//   }
// }

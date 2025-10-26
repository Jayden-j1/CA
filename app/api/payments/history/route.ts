// app/api/payments/history/route.ts
//
// Purpose:
// - Return filtered payment history for the billing dashboard.
// - Strictly enforce access rules to match Billing page UX requirements.
// - Includes a distinct "users" list for ADMIN + BUSINESS_OWNER to power UI dropdowns.
//
// Access Rules (must MATCH your frontend guard behaviour):
// ----------------------------------------------------------------------
// SUPER ADMIN (ADMIN with businessId == null)
//   - Can see ALL payments across the system.
//   - Can filter by ?purpose=PACKAGE|STAFF_SEAT and by ?user=<email>.
//   - Response includes `users` (distinct list of users who have payments).
//
// BUSINESS ADMIN (ADMIN with businessId != null)  ← ✅ NEW BEHAVIOUR
//   - Treated like a BUSINESS_OWNER scoped to their business only.
//   - Can filter by ?purpose and ?user=<email>, but results are scoped to their business.
//   - Response includes `users` list scoped to their business (only those with payments).
//
// BUSINESS_OWNER
//   - Must have a businessId.
//   - Can see ALL payments for their business (owner + staff).
//   - Can filter by ?purpose and ?user=<email>, but results are scoped to their business.
//   - Response includes `users` list scoped to their business (only those with payments).
//
// USER
//   - If staff-seat (businessId != null) → FORBIDDEN (403). Staff do not see Billing.
//   - If individual (businessId == null) and hasPaid === true → can see their OWN payments only.
//   - Else → FORBIDDEN (403).
//
// Query Params (validated lightly):
// - ?purpose=PACKAGE | STAFF_SEAT  (optional)
// - ?user=<userEmail>              (SUPER ADMIN + BUSINESS_OWNER + BUSINESS ADMIN)
//
// Notes:
// - The Payment model only stores `userId`, not `businessId`.
//   To fetch business-wide data we filter via nested relation:
//     where: { user: { businessId: <ownerBusinessId> } }
// - For SUPER ADMIN and business-scoped roles we include `user` in results
//   so Billing UI can show a "User" column.
// - This file is the **source of truth** for what any role may see.
//
// Security:
// - All role gating happens server-side here (cannot be bypassed by typing the URL).
// - Minimal change: only the ADMIN branch is refined to recognize "business admin"
//   (ADMIN with a businessId) vs "super admin" (ADMIN without a businessId).

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  // 1) Require authenticated session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Extract role + identity from session for decisions below
  const role = session.user.role as "ADMIN" | "BUSINESS_OWNER" | "USER";
  const userId = session.user.id;
  const businessId = session.user.businessId || null; // null for individual; non-null means staff/owner/admin tied to a business
  const hasPaid = Boolean(session.user.hasPaid);       // computed by NextAuth JWT callback

  try {
    // 3) Parse + normalize query params
    const { searchParams } = new URL(req.url);

    // Normalize purpose to uppercase and validate
    const purposeRaw = searchParams.get("purpose");
    const purposeParam =
      purposeRaw && ["PACKAGE", "STAFF_SEAT"].includes(purposeRaw.toUpperCase())
        ? (purposeRaw.toUpperCase() as "PACKAGE" | "STAFF_SEAT")
        : null;

    const userEmailParam = searchParams.get("user"); // Optional filter for SUPER ADMIN / BUSINESS OWNER / BUSINESS ADMIN

    // 4) Build a base "where" clause we can extend
    const baseWhere: any = {};
    if (purposeParam) {
      baseWhere.purpose = purposeParam;
    }

    // We'll populate `payments` and (optionally) `users` (for dropdowns)
    let payments: any[] = [];
    let users: { email: string; name: string | null }[] | undefined;

    // ============================================================
    // ADMIN
    // ============================================================
    if (role === "ADMIN") {
      // ✅ Distinguish SUPER ADMIN vs BUSINESS ADMIN by presence of businessId
      const isSuperAdmin = !businessId;

      if (isSuperAdmin) {
        // -------------------------
        // SUPER ADMIN (global view)
        // -------------------------
        const whereClause: any = { ...baseWhere };

        // Optional global user filter
        if (userEmailParam) {
          whereClause.user = { email: userEmailParam };
        }

        payments = await prisma.payment.findMany({
          where: whereClause,
          include: {
            user: { select: { email: true, name: true, role: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        users = await prisma.user.findMany({
          where: {
            payments: { some: {} },
          },
          select: { email: true, name: true },
          orderBy: { email: "asc" },
        });

        return NextResponse.json({ payments, users });
      } else {
        // -------------------------
        // BUSINESS ADMIN (scoped)
        // -------------------------
        // Treat exactly like BUSINESS_OWNER but keep the ADMIN role.
        const whereClause: any = {
          ...baseWhere,
          user: {
            businessId,
            ...(userEmailParam ? { email: userEmailParam } : {}),
          },
        };

        payments = await prisma.payment.findMany({
          where: whereClause,
          include: {
            user: { select: { email: true, name: true, role: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        users = await prisma.user.findMany({
          where: {
            businessId,
            payments: { some: {} },
          },
          select: { email: true, name: true },
          orderBy: { email: "asc" },
        });

        return NextResponse.json({ payments, users });
      }
    }

    // ============================================================
    // BUSINESS_OWNER: Must have businessId. Scope to their business only.
    // ============================================================
    if (role === "BUSINESS_OWNER") {
      if (!businessId) {
        // Owners should always have a businessId, but check anyway
        return NextResponse.json({ error: "Business not found" }, { status: 400 });
      }

      // Scope to current owner's business, optionally filter by a specific email
      const whereClause: any = {
        ...baseWhere,
        user: {
          businessId,
          ...(userEmailParam ? { email: userEmailParam } : {}),
        },
      };

      payments = await prisma.payment.findMany({
        where: whereClause,
        include: {
          user: { select: { email: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      // Distinct users within this business who have at least one payment
      users = await prisma.user.findMany({
        where: {
          businessId,
          payments: { some: {} },
        },
        select: { email: true, name: true },
        orderBy: { email: "asc" },
      });

      return NextResponse.json({ payments, users });
    }

    // ============================================================
    // USER:
    // - Staff-seat user (businessId != null) => FORBIDDEN.
    // - Individual user (businessId == null) must have hasPaid == true; can see own payments.
    // ============================================================
    if (role === "USER") {
      const isStaffSeat = !!businessId;

      // Staff Seating: role USER + belongs to a business → blocked from Billing
      if (isStaffSeat) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Individual user must be paid to access Billing
      if (!hasPaid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Only this user’s own payments are visible
      const whereClause: any = {
        ...baseWhere,
        userId,
      };

      payments = await prisma.payment.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      });

      // Individual user does not need distinct `users` for dropdown
      return NextResponse.json({ payments });
    }

    // Fallback: unknown role — forbid
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (err) {
    console.error("[API] Payment history error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

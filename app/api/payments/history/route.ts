// app/api/payments/history/route.ts
//
// Purpose:
// - Return filtered payment history for the billing dashboard.
// - Strictly enforce access rules to match Billing page UX requirements.
// - Includes a distinct "users" list for ADMIN + BUSINESS_OWNER to power UI dropdowns.
//
// ✅ Update (surgical, display-only):
// - Add a derived field `displayUser` for each payment so the Billing table can
//   show the *beneficiary* (the specific staff/individual) instead of the payer (owner)
//   when the purpose is STAFF_SEAT.
// - How we resolve the beneficiary for STAFF_SEAT rows:
//     1) If Payment.description encodes the staff email as "STAFF_SEAT:<email>",
//        we extract that staff email and look up the user by email.
//     2) If not present or not found, gracefully fall back to the payer (existing behavior).
// - For PACKAGE rows, `displayUser` = the payer (existing behavior).
//
// Why this fixes your symptom:
// - Payments for staff seats are charged to the owner, so `payment.user` is the owner.
//   That made the "User" column show owner info for every staff seat row.
// - This patch *only* augments the API response with a `displayUser` (beneficiary) and
//   keeps the underlying Payment/user relations, role gating, and filtering identical.
//
// Performance:
// - We avoid N+1 queries by collecting all staff emails from descriptions and doing
//   a single `findMany({ where: { email: { in: [...] } } })` to build a lookup.
//
// Security & Scope:
// - No change to who can see which payments. Only the **shape** of the response
//   is enriched for display. All role rules from before are preserved verbatim.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Purpose = "PACKAGE" | "STAFF_SEAT";

function parseStaffEmailFromDescription(desc: string | null | undefined): string | null {
  if (!desc) return null;
  // Accept both "STAFF_SEAT:email@domain" or "Staff Seat: email@domain"
  const m =
    desc.match(/STAFF[_\s]?SEAT[:\s]+([^\s,;]+@[^\s,;]+)/i) ||
    desc.match(/STAFF[_\s]?SEAT[:]?([^\s,;]+@[^\s,;]+)/i);
  return m?.[1]?.toLowerCase() || null;
}

export async function GET(req: Request) {
  // 1) Require authenticated session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Extract role + identity from session for decisions below
  const role = session.user.role;               // "ADMIN" | "BUSINESS_OWNER" | "USER"
  const userId = session.user.id;               // current user id
  const businessId = session.user.businessId || null; // null for individual or platform admin; non-null for staff/owner
  const hasPaid = Boolean(session.user.hasPaid);       // computed by NextAuth JWT callback

  try {
    // 3) Parse + normalize query params
    const { searchParams } = new URL(req.url);

    // Normalize purpose to uppercase and validate
    const purposeRaw = searchParams.get("purpose");
    const purposeParam =
      purposeRaw && ["PACKAGE", "STAFF_SEAT"].includes(purposeRaw.toUpperCase())
        ? (purposeRaw.toUpperCase() as Purpose)
        : null;

    const userEmailParam = searchParams.get("user"); // Optional filter for ADMIN/OWNER (scoped for staff-admin)

    // 4) Base where clause
    const baseWhere: any = {};
    if (purposeParam) baseWhere.purpose = purposeParam;

    // We will compute:
    //   - payments: array with `user` included (as before)
    //   - users: optional distinct list for dropdowns
    //   - displayUser: NEW derived field per payment for the Billing table
    let payments: any[] = [];
    let users: { email: string; name: string | null }[] | undefined;

    // ============================================================
    // ADMIN branch (platform-admin vs staff-admin scoped)
    // ============================================================
    if (role === "ADMIN") {
      if (!businessId) {
        // PLATFORM ADMIN (global)
        const whereClause: any = { ...baseWhere };
        if (userEmailParam) whereClause.user = { email: userEmailParam };

        payments = await prisma.payment.findMany({
          where: whereClause,
          include: { user: { select: { email: true, name: true, role: true } } },
          orderBy: { createdAt: "desc" },
        });

        users = await prisma.user.findMany({
          where: { payments: { some: {} } },
          select: { email: true, name: true },
          orderBy: { email: "asc" },
        });
      } else {
        // STAFF ADMIN (scoped to their business)
        const whereClause: any = {
          ...baseWhere,
          user: {
            businessId,
            ...(userEmailParam ? { email: userEmailParam } : {}),
          },
        };

        payments = await prisma.payment.findMany({
          where: whereClause,
          include: { user: { select: { email: true, name: true, role: true } } },
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
      }
    } else if (role === "BUSINESS_OWNER") {
      // ============================================================
      // BUSINESS_OWNER (scoped)
      // ============================================================
      if (!businessId) {
        return NextResponse.json({ error: "Business not found" }, { status: 400 });
      }

      const whereClause: any = {
        ...baseWhere,
        user: {
          businessId,
          ...(userEmailParam ? { email: userEmailParam } : {}),
        },
      };

      payments = await prisma.payment.findMany({
        where: whereClause,
        include: { user: { select: { email: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" },
      });

      users = await prisma.user.findMany({
        where: { businessId, payments: { some: {} } },
        select: { email: true, name: true },
        orderBy: { email: "asc" },
      });
    } else if (role === "USER") {
      // ============================================================
      // USER:
      // - Staff user (businessId != null) → forbid
      // - Individual paid user → own payments
      // ============================================================
      if (businessId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!hasPaid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const whereClause: any = { ...baseWhere, userId };

      payments = await prisma.payment.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      });

      // No `users` list needed for individuals
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ────────────────────────────────────────────────────────────
    // NEW: compute `displayUser` for each payment (beneficiary)
    // - For STAFF_SEAT: prefer staff user parsed from description
    // - For PACKAGE  : payer user as before
    // ────────────────────────────────────────────────────────────

    // 1) Collect all candidate staff emails from descriptions
    const candidateEmails = new Set<string>();
    for (const p of payments) {
      if ((p.purpose as Purpose) === "STAFF_SEAT") {
        const email = parseStaffEmailFromDescription(p.description);
        if (email) candidateEmails.add(email);
      }
    }

    // 2) Batch-load those users once
    const emailArr = Array.from(candidateEmails);
    const staffUsers = emailArr.length
      ? await prisma.user.findMany({
          where: { email: { in: emailArr } },
          select: { id: true, email: true, name: true, role: true },
        })
      : [];

    const staffByEmail = new Map<string, { email: string; name: string | null; role: string }>();
    for (const u of staffUsers) {
      staffByEmail.set(u.email.toLowerCase(), {
        email: u.email,
        name: u.name,
        role: u.role,
      });
    }

    // 3) Build enriched response with displayUser
    const enriched = payments.map((p) => {
      let displayUser: { email?: string; name?: string | null; role?: string } | undefined;

      if ((p.purpose as Purpose) === "STAFF_SEAT") {
        const staffEmail = parseStaffEmailFromDescription(p.description);
        if (staffEmail && staffByEmail.has(staffEmail)) {
          // ✅ beneficiary is the staff member who got the seat
          displayUser = staffByEmail.get(staffEmail);
        } else if (p.user) {
          // Fallback to payer (owner/admin) if we can't resolve staff
          displayUser = p.user;
        }
      } else {
        // PACKAGE → the payer (owner or individual)
        displayUser = p.user ?? undefined;
      }

      return {
        ...p,
        displayUser, // <-- used by the Billing UI
      };
    });

    // Return enriched structure (same fields as before + displayUser)
    return NextResponse.json({ payments: enriched, users });
  } catch (err) {
    console.error("[API] Payment history error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}























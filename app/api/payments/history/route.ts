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









// // app/api/payments/history/route.ts
// //
// // Purpose:
// // - Return filtered payment history for the billing dashboard.
// // - Strictly enforce access rules to match Billing page UX requirements.
// // - Includes a distinct "users" list for ADMIN + BUSINESS_OWNER to power UI dropdowns.
// //
// // ✅ Update (tiny, surgical):
// // - Distinguish between two kinds of ADMIN:
// //   1) Platform ADMIN (no businessId)  → full/global visibility (unchanged).
// //   2) Staff ADMIN (has businessId)    → visibility LIMITED to their own business,
// //      same as BUSINESS_OWNER. This prevents staff-admins from seeing all accounts.
// //
// // Why this fixes your bug:
// // - Previously, ALL ADMINs were treated as global. If a business owner promoted a staff
// //   member to ADMIN, that staff-admin gained global Billing access, which is dangerous.
// // - Now, only platform admins (no businessId) remain global. Staff-admins are safely scoped.
// //
// // Access Rules (now precise and explicit):
// // ----------------------------------------------------------------------
// // PLATFORM ADMIN (role=ADMIN AND businessId == null)
// //   - Can see ALL payments across the system.
// //   - Can filter by ?purpose=PACKAGE|STAFF_SEAT and by ?user=<email>.
// //   - Response includes `users` (distinct list of users who have payments).
// //
// // BUSINESS_OWNER
// //   - Must have a businessId.
// //   - Can see ALL payments for their business (owner + staff).
// //   - Can filter by ?purpose and ?user=<email>, but results are scoped to their business.
// //   - Response includes `users` list scoped to their business (only those with payments).
// //
// // STAFF ADMIN (role=ADMIN AND businessId != null)
// //   - Exactly the same visibility as BUSINESS_OWNER for *their* business only.
// //   - Prevents cross-business data exposure.
// //   - Response includes `users` scoped to their business.
// //
// // USER
// //   - If staff-seat (businessId != null) → FORBIDDEN (403). Staff do not see Billing.
// //   - If individual (businessId == null) and hasPaid === true → can see their OWN payments only.
// //   - Else → FORBIDDEN (403).
// //
// // Query Params (validated lightly):
// // - ?purpose=PACKAGE | STAFF_SEAT  (optional)
// // - ?user=<userEmail>              (ADMIN + BUSINESS_OWNER only; for staff-admin only within their business)
// //
// // Security:
// // - All role gating happens server-side here (cannot be bypassed by typing the URL).
// // - The same rule is mirrored in the UI (hiding Billing link for staff), but the API is the source of truth.

// import { NextResponse } from "next/server";
// import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/lib/auth";
// import { prisma } from "@/lib/prisma";

// export async function GET(req: Request) {
//   // 1) Require authenticated session
//   const session = await getServerSession(authOptions);
//   if (!session?.user?.id) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   // 2) Extract role + identity from session for decisions below
//   const role = session.user.role;               // "ADMIN" | "BUSINESS_OWNER" | "USER"
//   const userId = session.user.id;               // current user id
//   const businessId = session.user.businessId || null; // null for individual or platform admin; non-null for staff/owner
//   const hasPaid = Boolean(session.user.hasPaid);       // computed by NextAuth JWT callback

//   try {
//     // 3) Parse + normalize query params
//     const { searchParams } = new URL(req.url);

//     // Normalize purpose to uppercase and validate
//     const purposeRaw = searchParams.get("purpose");
//     const purposeParam =
//       purposeRaw && ["PACKAGE", "STAFF_SEAT"].includes(purposeRaw.toUpperCase())
//         ? (purposeRaw.toUpperCase() as "PACKAGE" | "STAFF_SEAT")
//         : null;

//     const userEmailParam = searchParams.get("user"); // Optional filter for ADMIN/OWNER (scoped for staff-admin)

//     // 4) Build a base "where" clause we can extend
//     const baseWhere: any = {};
//     if (purposeParam) {
//       baseWhere.purpose = purposeParam;
//     }

//     // We'll populate `payments` and (optionally) `users` (for dropdowns)
//     let payments: any[] = [];
//     let users: { email: string; name: string | null }[] | undefined;

//     // ============================================================
//     // ADMIN branch (now split into platform-admin vs staff-admin)
//     // ============================================================
//     if (role === "ADMIN") {
//       if (!businessId) {
//         // ------------------------------
//         // PLATFORM ADMIN (global access)
//         // ------------------------------
//         const whereClause: any = { ...baseWhere };

//         // Optional: filter a specific user by email globally
//         if (userEmailParam) {
//           whereClause.user = { email: userEmailParam };
//         }

//         payments = await prisma.payment.findMany({
//           where: whereClause,
//           include: {
//             user: { select: { email: true, name: true, role: true } },
//           },
//           orderBy: { createdAt: "desc" },
//         });

//         users = await prisma.user.findMany({
//           where: {
//             payments: { some: {} },
//           },
//           select: { email: true, name: true },
//           orderBy: { email: "asc" },
//         });

//         return NextResponse.json({ payments, users });
//       } else {
//         // ----------------------------------------
//         // STAFF ADMIN (scoped to their business)
//         // ----------------------------------------
//         const whereClause: any = {
//           ...baseWhere,
//           user: {
//             businessId,
//             ...(userEmailParam ? { email: userEmailParam } : {}),
//           },
//         };

//         payments = await prisma.payment.findMany({
//           where: whereClause,
//           include: {
//             user: { select: { email: true, name: true, role: true } },
//           },
//           orderBy: { createdAt: "desc" },
//         });

//         users = await prisma.user.findMany({
//           where: {
//             businessId,
//             payments: { some: {} },
//           },
//           select: { email: true, name: true },
//           orderBy: { email: "asc" },
//         });

//         return NextResponse.json({ payments, users });
//       }
//     }

//     // ============================================================
//     // BUSINESS_OWNER: Must have businessId. Scope to their business only.
//     // ============================================================
//     if (role === "BUSINESS_OWNER") {
//       if (!businessId) {
//         // Owners should always have a businessId, but check anyway
//         return NextResponse.json({ error: "Business not found" }, { status: 400 });
//       }

//       // Scope to current owner's business, optionally filter by a specific email
//       const whereClause: any = {
//         ...baseWhere,
//         user: {
//           businessId,
//           ...(userEmailParam ? { email: userEmailParam } : {}),
//         },
//       };

//       payments = await prisma.payment.findMany({
//         where: whereClause,
//         include: {
//           user: { select: { email: true, name: true, role: true } },
//         },
//         orderBy: { createdAt: "desc" },
//       });

//       // Distinct users within this business who have at least one payment
//       users = await prisma.user.findMany({
//         where: {
//           businessId,
//           payments: { some: {} },
//         },
//         select: { email: true, name: true },
//         orderBy: { email: "asc" },
//       });

//       return NextResponse.json({ payments, users });
//     }

//     // ============================================================
//     // USER:
//     // - Staff-seat user (businessId != null) => FORBIDDEN.
//     // - Individual user (businessId == null) must have hasPaid == true; can see own payments.
//     // ============================================================
//     if (role === "USER") {
//       const isStaffSeat = !!businessId;

//       // Staff Seating: role USER + belongs to a business → blocked from Billing
//       if (isStaffSeat) {
//         return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//       }

//       // Individual user must be paid to access Billing
//       if (!hasPaid) {
//         return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//       }

//       // Only this user’s own payments are visible
//       const whereClause: any = {
//         ...baseWhere,
//         userId,
//       };

//       payments = await prisma.payment.findMany({
//         where: whereClause,
//         orderBy: { createdAt: "desc" },
//       });

//       // Individual user does not need distinct `users` for dropdown
//       return NextResponse.json({ payments });
//     }

//     // Fallback: unknown role — forbid
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//   } catch (err) {
//     console.error("[API] Payment history error:", err);
//     return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
//   }
// }



















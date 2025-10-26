// app/api/payments/history/route.ts (only changed parts; full file shown for paste)
//
// Tiny display-only augmentation for STAFF_SEAT rows so the "User" column
// shows the *staff* person rather than the owner, using the structured
// description persisted by the webhook ("STAFF_SEAT:<staffEmail>").
//
// No change to authorization or scoping.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseStaffEmailFromDescription(desc: string | null | undefined): string | null {
  if (!desc) return null;
  const trimmed = desc.trim();
  if (!trimmed.startsWith("STAFF_SEAT:")) return null;
  const email = trimmed.substring("STAFF_SEAT:".length).trim();
  // Basic sanity: must look like an email
  return email.includes("@") ? email : null;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  const userId = session.user.id;
  const businessId = session.user.businessId || null;
  const hasPaid = Boolean(session.user.hasPaid);

  try {
    const { searchParams } = new URL(req.url);
    const purposeRaw = searchParams.get("purpose");
    const purposeParam =
      purposeRaw && ["PACKAGE", "STAFF_SEAT"].includes(purposeRaw.toUpperCase())
        ? (purposeRaw.toUpperCase() as "PACKAGE" | "STAFF_SEAT")
        : null;
    const userEmailParam = searchParams.get("user");

    const baseWhere: any = {};
    if (purposeParam) baseWhere.purpose = purposeParam;

    // ────────────────────────────────────────────────────────────
    // ADMIN
    // ────────────────────────────────────────────────────────────
    if (role === "ADMIN") {
      const whereClause: any = { ...baseWhere };
      if (userEmailParam) whereClause.user = { email: userEmailParam };

      const raw = await prisma.payment.findMany({
        where: whereClause,
        include: { user: { select: { email: true, name: true, role: true, businessId: true } } },
        orderBy: { createdAt: "desc" },
      });

      // Post-process only STAFF_SEAT rows (display fix)
      const payments = await Promise.all(
        raw.map(async (p) => {
          if (p.purpose !== "STAFF_SEAT") return p;

          const staffEmail = parseStaffEmailFromDescription(p.description);
          if (!staffEmail) return p;

          // Try to find that staff user (across system for Admins)
          const staff = await prisma.user.findFirst({
            where: { email: staffEmail },
            select: { email: true, name: true, role: true, businessId: true },
          });
          if (!staff) return p;

          // Replace the display user with staff (owner/userId stays the same in DB)
          return { ...p, user: staff };
        })
      );

      const users = await prisma.user.findMany({
        where: { payments: { some: {} } },
        select: { email: true, name: true },
        orderBy: { email: "asc" },
      });

      return NextResponse.json({ payments, users });
    }

    // ────────────────────────────────────────────────────────────
    // BUSINESS_OWNER
    // ────────────────────────────────────────────────────────────
    if (role === "BUSINESS_OWNER") {
      if (!businessId) {
        return NextResponse.json({ error: "Business not found" }, { status: 400 });
      }

      const whereClause: any = {
        ...baseWhere,
        user: { businessId, ...(userEmailParam ? { email: userEmailParam } : {}) },
      };

      const raw = await prisma.payment.findMany({
        where: whereClause,
        include: { user: { select: { email: true, name: true, role: true, businessId: true } } },
        orderBy: { createdAt: "desc" },
      });

      // Post-process only STAFF_SEAT rows (display fix within the same business)
      const payments = await Promise.all(
        raw.map(async (p) => {
          if (p.purpose !== "STAFF_SEAT") return p;

          const staffEmail = parseStaffEmailFromDescription(p.description);
          if (!staffEmail) return p;

          // Look up staff *within this owner’s business*
          const staff = await prisma.user.findFirst({
            where: { email: staffEmail, businessId },
            select: { email: true, name: true, role: true, businessId: true },
          });
          if (!staff) return p;

          return { ...p, user: staff };
        })
      );

      const users = await prisma.user.findMany({
        where: { businessId, payments: { some: {} } },
        select: { email: true, name: true },
        orderBy: { email: "asc" },
      });

      return NextResponse.json({ payments, users });
    }

    // ────────────────────────────────────────────────────────────
    // USER (Individual)
    // ────────────────────────────────────────────────────────────
    if (role === "USER") {
      const isStaffSeat = !!businessId;
      if (isStaffSeat) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (!hasPaid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const whereClause: any = { ...baseWhere, userId };

      // Keep including `user` so the UI shows the individual’s identity too.
      const payments = await prisma.payment.findMany({
        where: whereClause,
        include: { user: { select: { email: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ payments });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (err) {
    console.error("[API] Payment history error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
 








// app/api/payments/history/route.ts
// //
// // Purpose:
// // - Return filtered payment history for the billing dashboard.
// // - Strictly enforce access rules to match Billing page UX requirements.
// // - Includes a distinct "users" list for ADMIN + BUSINESS_OWNER to power UI dropdowns.
// //
// // Access Rules (must MATCH your frontend guard behaviour):
// // ----------------------------------------------------------------------
// // ADMIN
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
// // USER
// //   - If staff-seat (businessId != null) → FORBIDDEN (403). Staff do not see Billing.
// //   - If individual (businessId == null) and hasPaid === true → can see their OWN payments only.
// //   - ✅ UPDATE: include `user` fields in the response for individuals too,
// //               so the Billing table can display the User column consistently.
// //
// // Notes:
// // - The Payment model only stores `userId`, not `businessId`.
// //   To fetch business-wide data we filter via nested relation:
// //     where: { user: { businessId: <ownerBusinessId> } }
// // - For ADMIN + BUSINESS_OWNER we include `user` in results so Billing UI can show a "User" column.
// //   For individual users we NOW include `user` as well (small, safe change).
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
//   const businessId = session.user.businessId || null; // null for individual; non-null means staff/owner/admin tied to a business
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

//     const userEmailParam = searchParams.get("user"); // Optional filter for ADMIN/OWNER

//     // 4) Build a base "where" clause we can extend
//     const baseWhere: any = {};
//     if (purposeParam) {
//       baseWhere.purpose = purposeParam;
//     }

//     // We'll populate `payments` and (optionally) `users` (for dropdowns)
//     let payments: any[] = [];
//     let users: { email: string; name: string | null }[] | undefined;

//     // ============================================================
//     // ADMIN: Full access (all payments across all businesses).
//     // ============================================================
//     if (role === "ADMIN") {
//       const whereClause: any = { ...baseWhere };

//       // If a specific user email is provided, apply nested filter
//       if (userEmailParam) {
//         whereClause.user = { email: userEmailParam };
//       }

//       // Include user fields, so table can show "User" column
//       payments = await prisma.payment.findMany({
//         where: whereClause,
//         include: {
//           user: { select: { email: true, name: true, role: true } },
//         },
//         orderBy: { createdAt: "desc" },
//       });

//       // Build distinct user list for admins (only those with at least one payment)
//       users = await prisma.user.findMany({
//         where: {
//           payments: { some: {} },
//         },
//         select: { email: true, name: true },
//         orderBy: { email: "asc" },
//       });

//       return NextResponse.json({ payments, users });
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

//       // ✅ CHANGE (minimal): include the `user` relation so the Billing table
//       // can render the "User" column with name/email/account type even for individuals.
//       const whereClause: any = {
//         ...baseWhere,
//         userId,
//       };

//       payments = await prisma.payment.findMany({
//         where: whereClause,
//         include: {
//           user: { select: { email: true, name: true, role: true } },
//         },
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










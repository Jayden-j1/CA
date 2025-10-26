// app/api/payments/history/route.ts
//
// Purpose:
// - Return filtered payment history for the billing dashboard.
// - Strictly enforce access rules to match Billing page UX requirements.
// - Includes a distinct "users" list for ADMIN + BUSINESS_OWNER to power UI dropdowns.
//
// Access Rules (must MATCH your frontend guard behaviour):
// ----------------------------------------------------------------------
// ADMIN
//   - Can see ALL payments across the system.
//   - Can filter by ?purpose=PACKAGE|STAFF_SEAT and by ?user=<email>.
//   - Response includes `users` (distinct list of users who have payments).
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
//   - ✅ UPDATE: include `user` fields in the response for individuals too,
//               so the Billing table can display the User column consistently.
//
// Notes:
// - The Payment model only stores `userId`, not `businessId`.
//   To fetch business-wide data we filter via nested relation:
//     where: { user: { businessId: <ownerBusinessId> } }
// - For ADMIN + BUSINESS_OWNER we include `user` in results so Billing UI can show a "User" column.
//   For individual users we NOW include `user` as well (small, safe change).
//
// Security:
// - All role gating happens server-side here (cannot be bypassed by typing the URL).
// - The same rule is mirrored in the UI (hiding Billing link for staff), but the API is the source of truth.

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
  const role = session.user.role;               // "ADMIN" | "BUSINESS_OWNER" | "USER"
  const userId = session.user.id;               // current user id
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

    const userEmailParam = searchParams.get("user"); // Optional filter for ADMIN/OWNER

    // 4) Build a base "where" clause we can extend
    const baseWhere: any = {};
    if (purposeParam) {
      baseWhere.purpose = purposeParam;
    }

    // We'll populate `payments` and (optionally) `users` (for dropdowns)
    let payments: any[] = [];
    let users: { email: string; name: string | null }[] | undefined;

    // ============================================================
    // ADMIN: Full access (all payments across all businesses).
    // ============================================================
    if (role === "ADMIN") {
      const whereClause: any = { ...baseWhere };

      // If a specific user email is provided, apply nested filter
      if (userEmailParam) {
        whereClause.user = { email: userEmailParam };
      }

      // Include user fields, so table can show "User" column
      payments = await prisma.payment.findMany({
        where: whereClause,
        include: {
          user: { select: { email: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      // Build distinct user list for admins (only those with at least one payment)
      users = await prisma.user.findMany({
        where: {
          payments: { some: {} },
        },
        select: { email: true, name: true },
        orderBy: { email: "asc" },
      });

      return NextResponse.json({ payments, users });
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

      // ✅ CHANGE (minimal): include the `user` relation so the Billing table
      // can render the "User" column with name/email/account type even for individuals.
      const whereClause: any = {
        ...baseWhere,
        userId,
      };

      payments = await prisma.payment.findMany({
        where: whereClause,
        include: {
          user: { select: { email: true, name: true, role: true } },
        },
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









// // app/api/payments/history/route.ts
// //
// // Purpose
// // -------
// // Return payment history for Billing with strict access rules,
// // but with one critical presentation fix:
// //
// // 🔧 Fix: For STAFF_SEAT payments, the "User" column should show the
// //         *beneficiary staff member*, not the paying business owner.
// //         We now "rewrite" the returned `user` for STAFF_SEAT rows by
// //         resolving the staff from Stripe Checkout Session metadata:
// //
// //            metadata.staffEmail, metadata.staffName, metadata.staffRole
// //
// //         This does NOT change what we store in DB (payer remains owner/admin).
// //         It only changes the API response so the Billing UI can display the
// //         correct person in the "User" column.
// //
// // Why here?
// // ---------
// // - Your Payment model (userId) correctly points to the payer.
// // - Billing UI wants to *display* the beneficiary for STAFF_SEAT.
// // - Doing this swap server-side keeps the UI simple and avoids schema changes.
// //
// // Pillars
// // -------
// // Efficiency: Only enrich STAFF_SEAT rows; one Stripe call per such payment,
// //             in parallel. If metadata is missing or Stripe is unreachable,
// //             we gracefully fall back to the payer (owner/admin).
// // Robustness: Try DB lookup by staffEmail to include real role/name when possible.
// // Simplicity: No schema changes. The UI needs no changes.
// // Security: Access rules are unchanged & strictly enforced.
// //
// // Notes
// // -----
// // - For ADMIN and BUSINESS_OWNER queries we include a `user` object in results.
// //   For STAFF_SEAT rows we overwrite that `user` with the beneficiary staff.
// // - For individual USER view (their own billing) nothing changes.
// //
// // ------------------------------------------------------------------------------

// import { NextResponse } from "next/server";
// import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/lib/auth";
// import { prisma } from "@/lib/prisma";

// // ✅ Stripe is used ONLY to read metadata for STAFF_SEAT rows.
// import Stripe from "stripe";
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// type SafeUser = { email: string; name: string | null; role?: string };

// export async function GET(req: Request) {
//   // 1) Require authenticated session
//   const session = await getServerSession(authOptions);
//   if (!session?.user?.id) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   // 2) Extract role + identity from session for decisions below
//   const role = session.user.role;                 // "ADMIN" | "BUSINESS_OWNER" | "USER"
//   const userId = session.user.id;                 // current user id
//   const businessId = session.user.businessId || null; // null for individual; non-null for staff/owner/admin
//   const hasPaid = Boolean(session.user.hasPaid);

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

//     const baseWhere: any = {};
//     if (purposeParam) baseWhere.purpose = purposeParam;

//     // We'll populate `payments` and (optionally) `users` (for dropdowns)
//     let payments: any[] = [];
//     let users: { email: string; name: string | null }[] | undefined;

//     // ============================================================
//     // ADMIN: Full access (all payments across all businesses).
//     // ============================================================
//     if (role === "ADMIN") {
//       const whereClause: any = { ...baseWhere };
//       if (userEmailParam) whereClause.user = { email: userEmailParam };

//       payments = await prisma.payment.findMany({
//         where: whereClause,
//         include: {
//           user: { select: { email: true, name: true, role: true, businessId: true } },
//         },
//         orderBy: { createdAt: "desc" },
//       });

//       // Distinct users (for the search box suggestions)
//       users = await prisma.user.findMany({
//         where: { payments: { some: {} } },
//         select: { email: true, name: true },
//         orderBy: { email: "asc" },
//       });

//       // 🔁 Enrich STAFF_SEAT rows: swap `user` to the beneficiary staff
//       payments = await enrichStaffSeatRowsWithBeneficiary(payments);

//       return NextResponse.json({ payments, users });
//     }

//     // ============================================================
//     // BUSINESS_OWNER: must scope to their business only.
//     // ============================================================
//     if (role === "BUSINESS_OWNER") {
//       if (!businessId) {
//         return NextResponse.json({ error: "Business not found" }, { status: 400 });
//       }

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
//           user: { select: { email: true, name: true, role: true, businessId: true } },
//         },
//         orderBy: { createdAt: "desc" },
//       });

//       users = await prisma.user.findMany({
//         where: { businessId, payments: { some: {} } },
//         select: { email: true, name: true },
//         orderBy: { email: "asc" },
//       });

//       // 🔁 Enrich STAFF_SEAT rows: swap `user` to the beneficiary staff
//       payments = await enrichStaffSeatRowsWithBeneficiary(payments);

//       return NextResponse.json({ payments, users });
//     }

//     // ============================================================
//     // USER (individual or staff):
//     // - Staff (businessId != null) → FORBIDDEN.
//     // - Individual (businessId == null) must have hasPaid; see own payments.
//     // ============================================================
//     if (role === "USER") {
//       const isStaffSeat = !!businessId;
//       if (isStaffSeat) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//       if (!hasPaid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

//       const whereClause: any = { ...baseWhere, userId };
//       payments = await prisma.payment.findMany({
//         where: whereClause,
//         orderBy: { createdAt: "desc" },
//       });

//       // Individuals do not need `users` list, and no enrichment is required
//       // because they see only their own payments.
//       return NextResponse.json({ payments });
//     }

//     // Unknown role — forbid
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//   } catch (err) {
//     console.error("[API] Payment history error:", err);
//     return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
//   }
// }

// /**
//  * Enrich STAFF_SEAT payment rows so the returned `user` field represents
//  * the *beneficiary staff member* rather than the payer (owner/admin).
//  *
//  * Implementation details:
//  * - For each STAFF_SEAT payment, we retrieve its Stripe Checkout Session
//  *   (by `stripeId`) and read `metadata.{staffEmail, staffName, staffRole}`.
//  * - If we can find a matching user in DB by `staffEmail`, we use DB values
//  *   (email, name, role) to populate `user`.
//  * - Else we fall back to metadata (name/email/role), and finally to the payer.
//  * - PACKAGE rows are returned untouched.
//  *
//  * Fail-closed philosophy:
//  * - If Stripe is unreachable or metadata is missing, we leave the row as-is
//  *   (payer shown). This keeps Billing functional even during transient issues.
//  */
// async function enrichStaffSeatRowsWithBeneficiary(payments: any[]) {
//   // Quick exit if nothing to do
//   const staffRows = payments.filter((p) => p.purpose === "STAFF_SEAT" && p.stripeId);
//   if (staffRows.length === 0) return payments;

//   // Fetch each session in parallel (bounded only by the number of staff rows)
//   const sessionByStripeId = new Map<string, Stripe.Checkout.Session | null>();

//   await Promise.all(
//     staffRows.map(async (p) => {
//       try {
//         const s = await stripe.checkout.sessions.retrieve(p.stripeId);
//         sessionByStripeId.set(p.stripeId, s);
//       } catch (e) {
//         console.warn("[Billing] Unable to fetch Stripe session for", p.stripeId, e);
//         sessionByStripeId.set(p.stripeId, null);
//       }
//     })
//   );

//   // Build a new array with staff beneficiary overriding `user` where possible
//   const result = await Promise.all(
//     payments.map(async (p) => {
//       if (p.purpose !== "STAFF_SEAT" || !p.stripeId) return p;

//       const sess = sessionByStripeId.get(p.stripeId);
//       const meta = (sess?.metadata || {}) as Record<string, string | undefined>;

//       const staffEmail = (meta.staffEmail || "").toLowerCase().trim();
//       const staffName  = (meta.staffName  || "").trim();
//       const staffRole  = (meta.staffRole  || "").trim();

//       if (!staffEmail) {
//         // No beneficiary metadata → return row untouched
//         return p;
//       }

//       // Try to fetch the user from DB by email so we can return *real* role/name.
//       const dbStaff = await prisma.user.findUnique({
//         where: { email: staffEmail },
//         select: { email: true, name: true, role: true },
//       });

//       const beneficiary: SafeUser = dbStaff
//         ? { email: dbStaff.email, name: dbStaff.name, role: dbStaff.role }
//         : {
//             email: staffEmail,
//             name: staffName || null,
//             role: staffRole || undefined,
//           };

//       // 🔁 Replace the `user` object for STAFF_SEAT rows
//       return { ...p, user: beneficiary };
//     })
//   );

//   return result;
// }

// app/api/staff/create/route.ts
//
// Purpose
// -------
// Server-side creation of a staff account by a BUSINESS_OWNER or ADMIN.
// This endpoint is intentionally small, focused, and *only* creates the staff
// user. The *payment* for the seat is still handled by /api/staff/add.
//
// New in this revision (surgical change ONLY):
// -------------------------------------------
// • After successfully creating the staff user in Prisma, we now send them a
//   "Welcome" email via Resend that includes:
//     - their temporary (default) password, and
//     - a direct link to the /login page.
//
//   This removes the need for the business owner/admin to manually email the
//   temporary password, while keeping the overall flow exactly the same:
//
//     Owner/Admin → fills Add Staff form (with default password)
//                  → POST /api/staff/create
//                  → staff user is created in DB
//                  → *now* staff also receives an automated email
//                  → client then calls /api/staff/add for Stripe
//
// SECURITY NOTE:
// --------------
// • The default password is already being sent from the owner/admin to this API
//   in plaintext so we can hash it. This change *also* emails that same
//   temporary password to the staff member. That is acceptable in this design,
//   but you should treat this as a "first login only" bootstrap secret.
// • The staff user is still forced to change their password on first login
//   (mustChangePassword = true), so long-term credentials are *not* sent by email.
//
// Inputs (JSON)
// -------------
// { email: string, defaultPassword: string, role?: "USER" | "ADMIN", name?: string }
//
// Rules
// -----
// • Auth required; role must be BUSINESS_OWNER or ADMIN
// • Caller must belong to a business (businessId != null)
// • Email domain must match business owner’s email domain (exact or subdomain)
// • defaultPassword is required; new user must change it on first login
//
// Outputs (JSON)
// --------------
// 201 { staff: { id, email, name, role } }
// 400/401/403/409 with { error } on failure
//
// Pillars
// -------
// • Efficiency: tiny, single responsibility; one DB write, one email send
// • Robustness: strict validation, clear errors; email failure does NOT break staff creation
// • Simplicity: small file, minimal new logic
// • Ease of management: mirrors your existing patterns (NextAuth/prisma/Resend)
// • Security: role-gated, server-side domain enforcement, bcrypt hashing

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendStaffWelcomeEmail } from "@/lib/email/resendClient";

type Role = "USER" | "ADMIN";

/** Extract the domain from an email (after the '@'), or null if invalid. */
function extractDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

/** Candidate is allowed if it is exactly base, or a subdomain of base. */
function isAllowedDomain(candidate: string | null, base: string | null): boolean {
  if (!candidate || !base) return false;
  if (candidate === base) return true;
  return candidate.endsWith("." + base);
}

/**
 * Resolve the public base URL for building app links in emails.
 *
 * Priority:
 *   1. NEXT_PUBLIC_APP_URL (recommended for prod)
 *   2. Fallback to the request's URL (protocol + host) for previews/local
 *   3. Last resort: http://localhost:3000
 */
function resolveAppBaseUrl(req: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, ""); // strip trailing slash

  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://localhost:3000";
  }
}

export async function POST(req: Request) {
  // 1) Auth + role gate
  const session = await getServerSession(authOptions);
  const caller = session?.user;
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (caller.role !== "BUSINESS_OWNER" && caller.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!caller.businessId) {
    return NextResponse.json(
      { error: "No business assigned to your account" },
      { status: 400 }
    );
  }

  // 2) Parse input
  let body: { email?: string; defaultPassword?: string; role?: Role; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email || "").toLowerCase().trim();
  const defaultPassword = (body.defaultPassword || "").trim(); // <-- also used for the welcome email
  const role: Role = body.role === "ADMIN" ? "ADMIN" : "USER"; // default USER
  const name = (body.name || "").trim();

  if (!email || !defaultPassword) {
    return NextResponse.json(
      { error: "Email and default password are required" },
      { status: 400 }
    );
  }

  // 3) Server-side domain enforcement (authoritative)
  //    We use the *owner/admin’s* email domain as the base policy, which mirrors
  //    your /api/business/domain logic & prior fixes.
  const ownerDomain = extractDomain(caller.email || "");
  const candidateDomain = extractDomain(email);
  if (!isAllowedDomain(candidateDomain, ownerDomain)) {
    return NextResponse.json(
      { error: `Email must use @${ownerDomain} or one of its subdomains` },
      { status: 400 }
    );
  }

  // 4) Ensure email is not already taken
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  // 5) Create staff user
  //
  //    - We hash the defaultPassword for storage.
  //    - We flag `mustChangePassword = true` so this password is only a bootstrap secret.
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const created = await prisma.user.create({
    data: {
      name: name || email.split("@")[0],
      email,
      hashedPassword,
      role, // "USER" | "ADMIN"
      businessId: caller.businessId, // tie to caller’s business
      isActive: true,
      mustChangePassword: true, // force change at first login
      hasPaid: false, // access inherited from owner after seat purchase
    },
    select: { id: true, email: true, name: true, role: true },
  });

  // 6) Fire-and-forget style welcome email:
  //
  //    - Includes:
  //        • Staff name (best-effort)
  //        • Temporary password the owner/admin set
  //        • A direct /login URL
  //    - If the email provider fails, we *still* return 201 so the staff user
  //      exists and the owner can manually communicate if needed.
  try {
    const baseUrl = resolveAppBaseUrl(req);
    const loginUrl = `${baseUrl}/login`;

    await sendStaffWelcomeEmail({
      to: created.email,
      name: created.name || created.email.split("@")[0],
      temporaryPassword: defaultPassword,
      loginUrl,
    });
  } catch (err) {
    console.warn("[staff/create] Failed to send staff welcome email (continuing):", err);
    // No rethrow: staff creation must not be blocked by email provider issues.
  }

  // 7) Return only non-sensitive fields
  return NextResponse.json({ staff: created }, { status: 201 });
}









// // app/api/staff/create/route.ts
// //
// // Purpose
// // -------
// // Server-side creation of a staff account by a BUSINESS_OWNER or ADMIN.
// // This endpoint is intentionally small, focused, and *only* creates the staff
// // user. The *payment* for the seat is still handled by /api/staff/add.
// //
// // Why this fixes your symptoms
// // ---------------------------
// // • Your client form posts to /api/staff/create first. The 404 made the browser
// //   receive an HTML error page, which then caused the JSON parse error
// //   "Unexpected token '<'". Adding this route resolves both issues at once.
// // • This route also *validates* email domain & role on the server, so behavior
// //   is correct even if the client-side checks are bypassed.
// //
// // Inputs (JSON)
// // -------------
// // { email: string, defaultPassword: string, role?: "USER" | "ADMIN", name?: string }
// //
// // Rules
// // -----
// // • Auth required; role must be BUSINESS_OWNER or ADMIN
// // • Caller must belong to a business (businessId != null)
// // • Email domain must match business owner’s email domain (exact or subdomain)
// // • defaultPassword is required; new user must change it on first login
// //
// // Outputs (JSON)
// // --------------
// // 201 { staff: { id, email, name, role } }
// // 400/401/403/409 with { error } on failure
// //
// // Pillars
// // -------
// // • Efficiency: tiny, single responsibility; one DB write
// // • Robustness: strict validation, clear errors
// // • Simplicity: small file, no extra dependencies
// // • Ease of management: mirrors your existing patterns (NextAuth/prisma)
// // • Security: role-gated, server-side domain enforcement, bcrypt hashing

// import { NextResponse } from "next/server";
// import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/lib/auth";
// import { prisma } from "@/lib/prisma";
// import bcrypt from "bcryptjs";

// type Role = "USER" | "ADMIN";

// /** Extract the domain from an email (after the '@'), or null if invalid. */
// function extractDomain(email: string | null | undefined): string | null {
//   if (!email) return null;
//   const at = email.lastIndexOf("@");
//   if (at < 0 || at === email.length - 1) return null;
//   return email.slice(at + 1).toLowerCase().trim();
// }

// /** Candidate is allowed if it is exactly base, or a subdomain of base. */
// function isAllowedDomain(candidate: string | null, base: string | null): boolean {
//   if (!candidate || !base) return false;
//   if (candidate === base) return true;
//   return candidate.endsWith("." + base);
// }

// export async function POST(req: Request) {
//   // 1) Auth + role gate
//   const session = await getServerSession(authOptions);
//   const caller = session?.user;
//   if (!caller) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }
//   if (caller.role !== "BUSINESS_OWNER" && caller.role !== "ADMIN") {
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//   }
//   if (!caller.businessId) {
//     return NextResponse.json({ error: "No business assigned to your account" }, { status: 400 });
//   }

//   // 2) Parse input
//   let body: { email?: string; defaultPassword?: string; role?: Role; name?: string };
//   try {
//     body = await req.json();
//   } catch {
//     return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
//   }

//   const email = (body.email || "").toLowerCase().trim();
//   const defaultPassword = (body.defaultPassword || "").trim();
//   const role: Role = body.role === "ADMIN" ? "ADMIN" : "USER"; // default USER
//   const name = (body.name || "").trim();

//   if (!email || !defaultPassword) {
//     return NextResponse.json({ error: "Email and default password are required" }, { status: 400 });
//   }

//   // 3) Server-side domain enforcement (authoritative)
//   //    We use the *owner/admin’s* email domain as the base policy, which mirrors
//   //    your /api/business/domain logic & prior fixes.
//   const ownerDomain = extractDomain(caller.email || "");
//   const candidateDomain = extractDomain(email);
//   if (!isAllowedDomain(candidateDomain, ownerDomain)) {
//     return NextResponse.json(
//       { error: `Email must use @${ownerDomain} or one of its subdomains` },
//       { status: 400 }
//     );
//   }

//   // 4) Ensure email is not already taken
//   const existing = await prisma.user.findUnique({ where: { email } });
//   if (existing) {
//     return NextResponse.json({ error: "Email already in use" }, { status: 409 });
//   }

//   // 5) Create staff user
//   const hashedPassword = await bcrypt.hash(defaultPassword, 10);

//   const created = await prisma.user.create({
//     data: {
//       name: name || email.split("@")[0],
//       email,
//       hashedPassword,
//       role, // "USER" | "ADMIN"
//       businessId: caller.businessId, // tie to caller’s business
//       isActive: true,
//       mustChangePassword: true, // force change at first login
//       hasPaid: false, // access inherited from owner after seat purchase
//     },
//     select: { id: true, email: true, name: true, role: true },
//   });

//   // 6) Return only non-sensitive fields
//   return NextResponse.json({ staff: created }, { status: 201 });
// }

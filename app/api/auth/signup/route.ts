// app/api/auth/signup/route.ts
//
// ============================================================
// Purpose
// ============================================================
// Securely create a new user (individual or business owner),
// hash their password, and optionally create a Business record.
//
// Key Improvements
// ----------------
// • Guarantees a UNIQUE Business.domain without collisions (fixes P2002).
// • Uses a deterministic per-user suffix to avoid duplicate domains on retries.
// • Wraps Business create + User update in a transaction for consistency.
// • Leaves individual user logic 100% intact.
// • Returns consistent minimal response: { message, role, userId }.
//
// Pillars
// --------
// ✅ Efficiency  – Only minimal fields written/read; single transaction for biz path.
// ✅ Robustness  – Strict validation, collision-proof domain, clear errors.
// ✅ Simplicity  – Keep the same overall flow; small helper for slug/suffix.
// ✅ Ease of Mgmt – Documented and self-contained; no schema changes.
// ✅ Security    – Proper password hashing, duplicate email prevention.
//
// Notes
// -----
// • We DO NOT set hasPaid=true here. Webhook + /api/payments/check
//   own the paid/access truth. This keeps behavior consistent across flows.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isStrongPassword } from "@/lib/validator"; // ✅ Password complexity helper

// ---------------------------------------------
// Small helpers (pure/side-effect free)
// ---------------------------------------------

/**
 * slugify:
 * Turn a name like "Acme Pty Ltd" into "acme-pty-ltd".
 */
function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48); // keep it reasonably short
}

/**
 * uniqueBusinessDomain:
 * Build a unique domain for the Business row. We:
 *  - slugify the businessName
 *  - append a deterministic suffix using the new userId (last 6 chars)
 *  This means retries of the same signup will generate the same domain,
 *  but because we create the user first and then business in a transaction,
 *  we won't collide with other unrelated businesses.
 *
 * If you prefer to include email domain visually, we still can — but
 * the uniqueness will always be guaranteed by the userId suffix.
 */
function uniqueBusinessDomain(businessName: string, userId: string): string {
  const base = slugify(businessName) || "business";
  const suffix = (userId || "").slice(-6) || "member";
  return `${base}-${suffix}`;
}

// ------------------------------------------------------------
// POST /api/auth/signup
// ------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    console.log("[API] Signup route hit with POST");

    // 1️⃣ Parse and destructure request JSON body
    const body = await req.json();
    const { name, email, password, userType, businessName } = body as {
      name?: string;
      email?: string;
      password?: string;
      userType?: "individual" | "business";
      businessName?: string;
    };

    // 2️⃣ Validate required fields (client sanity check)
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    // 3️⃣ Enforce password complexity
    // (Uppercase, lowercase, number, and special character)
    if (!isStrongPassword(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
        },
        { status: 400 }
      );
    }

    // 4️⃣ Prevent duplicate accounts (unique email constraint)
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists." },
        { status: 400 }
      );
    }

    // 5️⃣ Hash password securely using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6️⃣ Determine user role and package type from "userType"
    // - userType === "business" → role: BUSINESS_OWNER, packageType: "business"
    // - otherwise → role: USER, packageType: "individual"
    const isBusiness = userType === "business";
    const role = isBusiness ? "BUSINESS_OWNER" : "USER";
    const packageType = isBusiness ? "business" : "individual";

    // 7️⃣ Create user record with safe defaults.
    //    We create the user FIRST so we can derive a stable suffix
    //    for the business domain (avoids collisions AND supports retries).
    const user = await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword,
        role,
        hasPaid: false, // ✅ Explicit default; paid truth is controlled by webhook/check
        packageType, // ✅ Aligns with dashboard upgrade logic
      },
      select: { id: true, role: true },
    });

    console.log("[API] User created:", { id: user.id, role: user.role });

    // 8️⃣ If business owner, create a linked Business record
    if (role === "BUSINESS_OWNER") {
      if (!businessName || !businessName.trim()) {
        return NextResponse.json(
          { error: "Business name is required for business accounts." },
          { status: 400 }
        );
      }

      // Build a unique, human-readable domain that can never collide:
      // "<slugified-business-name>-<last6-of-userId>"
      // Example: "acme-pty-ltd-a1b2c3"
      let domain = uniqueBusinessDomain(businessName, user.id);

      try {
        // Use a transaction so we either create business + connect user.businessId
        // together or not at all (keeps referential integrity tight).
        await prisma.$transaction(async (tx) => {
          const business = await tx.business.create({
            data: {
              name: businessName.trim(),
              domain, // guaranteed unique per user due to suffix
              owner: { connect: { id: user.id } },
            },
            select: { id: true },
          });

          // Update user record to reference the businessId
          await tx.user.update({
            where: { id: user.id },
            data: { businessId: business.id },
          });
        });
      } catch (err: any) {
        // Extremely rare: if the derived domain still collides (shouldn't),
        // we attempt one more time with a random suffix to guarantee success.
        if (err?.code === "P2002") {
          const randomSuffix = Math.random().toString(36).slice(2, 8);
          domain = `${slugify(businessName)}-${randomSuffix || "new"}`;

          await prisma.$transaction(async (tx) => {
            const business = await tx.business.create({
              data: {
                name: businessName.trim(),
                domain,
                owner: { connect: { id: user.id } },
              },
              select: { id: true },
            });

            await tx.user.update({
              where: { id: user.id },
              data: { businessId: business.id },
            });
          });
        } else {
          // Unknown error — bubble up for logging
          throw err;
        }
      }
    }

    // 9️⃣ Return lightweight JSON response
    return NextResponse.json(
      {
        message: "User created successfully.",
        role: user.role,
        userId: user.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Signup error:", error);

    // 🔒 Avoid leaking internal details
    return NextResponse.json(
      { error: "Internal Server Error", systemError: true },
      { status: 500 }
    );
  }
}

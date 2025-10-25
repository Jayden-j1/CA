// app/api/auth/signup/route.ts
//
// ============================================================
// Purpose
// ============================================================
// Securely create a new user (individual or business owner),
// hash their password, and optionally create a Business record.
//
// What’s new in this patch (P2022 fix)
// ------------------------------------
// • Some databases have not yet applied the `emailDomain` column on the
//   "Business" table. Writing to a non-existent column throws Prisma P2022.
// • We *dynamically detect* whether the column exists before we create the
//   Business row and only include `emailDomain` in the data when present.
// • This resolves the immediate error WITHOUT changing any other logic.
//   (If you later add the column via migration, the same code will detect it
//    and begin writing to it automatically.)
//
// Pillars
// -------
// ✅ Efficiency  – one tiny information_schema query
// ✅ Robustness  – works whether column exists or not
// ✅ Simplicity  – single guard; all other logic unchanged
// ✅ Ease of mgmt – you can still add the column later via migration
// ✅ Security    – same validation and bcrypt handling as before
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isStrongPassword } from "@/lib/validator";

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
 * uniqueBusinessHandle:
 * Build the INTERNAL unique handle for Business.domain.
 * We slugify the businessName and append a deterministic suffix based on userId.
 * Example: "acme-pty-ltd-a1b2c3"
 */
function uniqueBusinessHandle(businessName: string, userId: string): string {
  const base = slugify(businessName) || "business";
  const suffix = (userId || "").slice(-6) || "member";
  return `${base}-${suffix}`;
}

/**
 * extractEmailDomain:
 * Returns the human-visible email domain from an address, e.g. "example.com".
 * If anything is off, returns undefined (caller can skip storing).
 */
function extractEmailDomain(email?: string): string | undefined {
  if (!email) return undefined;
  const at = email.indexOf("@");
  if (at < 0 || at === email.length - 1) return undefined;
  return email.slice(at + 1).toLowerCase();
}

/**
 * hasBusinessColumn:
 * Minimal, read-only check in Postgres information_schema to see whether a column exists
 * on the Business table. We guard for quoted table names ("Business") and lower-case
 * (business) just in case.
 *
 * NOTE: This is intentionally defensive and returns `false` on any query error
 *       so the flow never breaks for read-only issues.
 */
async function hasBusinessColumn(columnName: string): Promise<boolean> {
  try {
    // Query information_schema; restrict to current schemas for safety
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE (table_schema = 'public' OR table_schema = current_schema())
          AND (table_name = 'Business' OR lower(table_name) = 'business')
          AND column_name = ${columnName}
      ) AS "exists";
    `;
    return Boolean(rows?.[0]?.exists);
  } catch {
    // If the metadata query fails for any reason, be conservative.
    return false;
  }
}

// ------------------------------------------------------------
// POST /api/auth/signup
// ------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    console.log("[API] Signup route hit with POST");

    // 1) Parse the body
    const body = await req.json();
    const { name, email, password, userType, businessName } = body as {
      name?: string;
      email?: string;
      password?: string;
      userType?: "individual" | "business";
      businessName?: string;
    };

    // 2) Basic validation
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    // 3) Password complexity
    if (!isStrongPassword(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
        },
        { status: 400 }
      );
    }

    // 4) Duplicate email guard
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "User already exists." }, { status: 400 });
    }

    // 5) Hash password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6) Role + package type
    const isBusiness = userType === "business";
    const role = isBusiness ? "BUSINESS_OWNER" : "USER";
    const packageType = isBusiness ? "business" : "individual";

    // 7) Create the user FIRST (lets us derive a deterministic Business handle)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword,
        role,
        hasPaid: false, // paid truth via webhooks/check
        packageType,
      },
      select: { id: true, role: true },
    });

    console.log("[API] User created:", { id: user.id, role: user.role });

    // 8) If business owner, create Business + link to user in one transaction
    if (role === "BUSINESS_OWNER") {
      if (!businessName?.trim()) {
        return NextResponse.json(
          { error: "Business name is required for business accounts." },
          { status: 400 }
        );
      }

      // INTERNAL unique handle (slug + id suffix)
      let internalHandle = uniqueBusinessHandle(businessName, user.id);

      // DISPLAY/ENFORCEMENT domain: the owner’s actual email host (e.g. "example.com")
      const emailDomain = extractEmailDomain(email);

      // 🔎 NEW: Detect whether the DB currently has the "emailDomain" column.
      // If present -> include it in writes. If absent -> omit it (prevents P2022).
      const canWriteEmailDomain = await hasBusinessColumn("emailDomain");

      try {
        await prisma.$transaction(async (tx) => {
          const business = await tx.business.create({
            data: {
              name: businessName.trim(),
              domain: internalHandle, // INTERNAL unique handle
              // ✅ Only add this property if the column exists in the database.
              ...(canWriteEmailDomain && emailDomain ? { emailDomain } : {}),
              owner: { connect: { id: user.id } },
            },
            select: { id: true },
          });

          // Attach business to user
          await tx.user.update({
            where: { id: user.id },
            data: { businessId: business.id },
          });
        });
      } catch (err: any) {
        // If (extremely rare) the derived handle collides, try once with a random suffix.
        if (err?.code === "P2002") {
          const randomSuffix = Math.random().toString(36).slice(2, 8);
          internalHandle = `${slugify(businessName)}-${randomSuffix || "new"}`;

          await prisma.$transaction(async (tx) => {
            const business = await tx.business.create({
              data: {
                name: businessName.trim(),
                domain: internalHandle,
                ...(canWriteEmailDomain && emailDomain ? { emailDomain } : {}),
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
          throw err; // bubble up unchanged
        }
      }
    }

    // 9) Minimal response (client will sign the user in)
    return NextResponse.json(
      { message: "User created successfully.", role: user.role, userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Signup error:", error);
    return NextResponse.json({ error: "Internal Server Error", systemError: true }, { status: 500 });
  }
}

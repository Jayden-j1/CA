// app/api/auth/signup/route.ts
//
// ============================================================
// Purpose
// ============================================================
// Securely create a new user (individual or business owner),
// hash their password, and optionally create a Business record.
//
// What’s new (surgical, backward-compatible):
// ------------------------------------------
// • We now capture *both*:
//    - Business.domain      → INTERNAL unique handle (slug + suffix), used by the app
//    - Business.emailDomain → DISPLAY/ENFORCEMENT domain (e.g., "example.com")
// • This fixes the “Only emails from @company-d1drge …” UI text by letting
//   the UI read Business.emailDomain (human-readable) instead of Business.domain.
// • Same transaction as before: create Business + attach user.businessId atomically.
//
// Pillars
// -------
// ✅ Efficiency  – Minimal reads/writes; single transaction for business path
// ✅ Robustness  – Deterministic unique handle; validation and clear errors
// ✅ Simplicity  – Small pure helpers; minimal code changes
// ✅ Ease of Mgmt – Thorough comments; obvious intent
// ✅ Security    – Bcrypt hashing; duplicate email guard; no client trust for roles
//
// NOTE: We DO NOT set hasPaid=true here. Server truth is owned by
// Stripe webhooks + /api/payments/check. Individual-account logic remains untouched.

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

      try {
        await prisma.$transaction(async (tx) => {
          const business = await tx.business.create({
            data: {
              name: businessName.trim(),
              domain: internalHandle, // INTERNAL unique handle
              emailDomain,            // Human-friendly domain for staff policy & UI
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
                emailDomain,
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
          throw err; // bubble up
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

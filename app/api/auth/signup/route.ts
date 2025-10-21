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
// • Adds safe default flags: hasPaid=false and packageType
// • Keeps full backward compatibility with your working logic
// • Does not auto-sign-in (signup form handles that client-side)
// • Returns consistent minimal response: { message, role, userId }
//
// Pillars
// --------
// ✅ Efficiency  – Only minimal fields written/read.
// ✅ Robustness  – Strict validation, error handling, default flags.
// ✅ Simplicity  – Pure single-purpose route (no auth/session mixing).
// ✅ Ease of Management  – Explicit defaults for payment & plan type.
// ✅ Security  – Proper password hashing, duplicate prevention.
//

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isStrongPassword } from "@/lib/validator"; // ✅ Password complexity helper

// ------------------------------------------------------------
// POST /api/auth/signup
// ------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    console.log("[API] Signup route hit with POST");

    // 1️⃣ Parse and destructure request JSON body
    const body = await req.json();
    const { name, email, password, userType, businessName } = body;

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

    // 7️⃣ Create user record with safe defaults
    // - hasPaid: false (ensures gating logic is deterministic)
    // - packageType: set for upgrade filtering
    const user = await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword,
        role,
        hasPaid: false,        // ✅ Explicit default
        packageType,           // ✅ Aligns with dashboard upgrade logic
      },
      select: { id: true, role: true },
    });

    console.log("[API] User created:", { id: user.id, role: user.role });

    // 8️⃣ If business owner, create a linked Business record
    if (role === "BUSINESS_OWNER") {
      if (!businessName) {
        return NextResponse.json(
          { error: "Business name is required for business accounts." },
          { status: 400 }
        );
      }

      // Derive domain for staff linking (e.g., example.com)
      const emailDomain = email.split("@")[1];

      // Create business and connect to owner
      const business = await prisma.business.create({
        data: {
          name: businessName,
          domain: emailDomain,
          owner: { connect: { id: user.id } },
        },
        select: { id: true },
      });

      // Update user record to reference the businessId
      await prisma.user.update({
        where: { id: user.id },
        data: { businessId: business.id },
      });
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

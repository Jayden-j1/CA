// app/api/auth/signup/route.ts
//
// Purpose:
// - Handle signup for individuals + business owners.
// - Hash password securely with bcrypt before saving.
// - Create Business record for BUSINESS_OWNER signups.
// - Return user role so frontend can show tailored toast.
//
// Notes:
// - Only supports POST.
// - Logs useful info to server console.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    console.log("[API] Signup route hit with POST");

    const body = await req.json();
    const { name, email, password, userType, businessName } = body;

    // 1. Validate fields
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 2. Prevent duplicate signup
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    // 3. Hash password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Determine role
    const role = userType === "business" ? "BUSINESS_OWNER" : "USER";

    // 5. Create user with hashed password
    const user = await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword, // ✅ matches schema.prisma
        role,
      },
    });

    // 6. If business owner → create Business record
    if (role === "BUSINESS_OWNER") {
      if (!businessName) {
        return NextResponse.json(
          { error: "Business name required for business accounts" },
          { status: 400 }
        );
      }

      const emailDomain = email.split("@")[1];
      const business = await prisma.business.create({
        data: {
          name: businessName,
          domain: emailDomain,
          owner: { connect: { id: user.id } },
        },
      });

      // Link business back to user
      await prisma.user.update({
        where: { id: user.id },
        data: { businessId: business.id },
      });
    }

    return NextResponse.json(
      { message: "User created successfully", role: user.role },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Signup error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Disallow GET
export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed. Use POST." },
    { status: 405 }
  );
}

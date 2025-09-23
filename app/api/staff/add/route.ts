// app/api/staff/add/route.ts
//
// Purpose:
// - Allow business owners to add staff accounts under their business.
// - Staff accounts are created with role "USER" and linked to the business.
// - Passwords are securely hashed before saving.
//
// Notes:
// - Accepts POST only.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, businessId } = await req.json();

    // 1. Validate input
    if (!name || !email || !password || !businessId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 2. Prevent duplicate staff email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // 3. Hash staff password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create staff user linked to business
    const staff = await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword, // ✅ schema field
        role: "USER",   // staff are always regular users
        businessId,     // link staff to business
      },
    });

    return NextResponse.json(
      { message: "Staff member created", staff },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Staff add error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

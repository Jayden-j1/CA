// app/api/staff/add/route.ts
//
// Purpose:
// - Allow business owners to add staff members to their company.
// - Each staff gets a User record linked to the owner’s Business.
// - Passwords are securely hashed before saving.
// - Uses Prisma + bcrypt.
//
// Notes:
// - Matches Prisma schema: we now use `hashedPassword` instead of `password`.
// - Only supports POST requests.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    // 1. Parse JSON body
    const { name, email, password, businessId } = await req.json();

    // 2. Validate required fields
    if (!name || !email || !password || !businessId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 3. Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create staff user
    const staff = await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword, // ✅ correct field name in schema
        role: "USER",   // staff are regular users
        businessId,     // link staff to the business
      },
    });

    // 5. Return success response
    return NextResponse.json(
      { message: "Staff member created successfully", staff },
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

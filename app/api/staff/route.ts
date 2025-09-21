// app/api/staff/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    // 1️. Get the current user session
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2️. Only BUSINESS_OWNER can add staff
    if (session.user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3️. Get request body
    const { name, email, password } = await req.json();
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 4️. Fetch business of current owner
    const businessId = session.user.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "Business not found" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 400 });
    }

    // 5️. Check staff email matches business domain
    const emailDomain = email.split("@")[1];
    if (emailDomain.toLowerCase() !== business.domain.toLowerCase()) {
      return NextResponse.json({
        error: `Email must match business domain: ${business.domain}`,
      }, { status: 400 });
    }

    // 6️. Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    // 7️. Hash staff password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 8️. Create staff user
    const staffUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "USER",            // staff cannot add/remove users
        businessId: business.id, // link to business
      },
    });

    return NextResponse.json({ message: "Staff user added successfully", user: staffUser });
  } catch (error) {
    console.error("Add staff error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

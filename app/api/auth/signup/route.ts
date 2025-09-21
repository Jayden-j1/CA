// app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, userType, businessName } = await req.json();

    if (!name || !email || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return NextResponse.json({ error: "User already exists" }, { status: 400 });

    const hashedPassword = await bcrypt.hash(password, 10);

    let businessId: string | null = null;

    if (userType === "business") {
      const emailDomain = email.split("@")[1];
      const business = await prisma.business.create({
        data: { name: businessName, domain: emailDomain },
      });
      businessId = business.id;
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword, // store hashed password here
        role: userType === "business" ? "BUSINESS_OWNER" : "USER",
        businessId: businessId ?? null,
      },
    });

    if (userType === "business" && businessId) {
      await prisma.business.update({
        where: { id: businessId },
        data: { ownerId: user.id },
      });
    }

    return NextResponse.json({ message: "User created successfully" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

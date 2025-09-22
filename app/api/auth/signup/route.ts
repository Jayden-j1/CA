// app/api/auth/signup/route.ts
//
// This API route handles signups for both:
// - Individual users (role = USER)
// - Business owners (role = BUSINESS_OWNER + creates a Business record)
//
// Notes:
// - We hash the password using bcrypt before storing it.
// - If the account type is "business", we create the User first,
//   then create a Business linked to that User as owner.
// - After that, we update the User with businessId so they are tied
//   to the business they created.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    // 1. Extract fields from request body
    const { name, email, password, userType, businessName } = await req.json();

    // 2. Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 3. Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    // 4. Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Create the user first
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: userType === "business" ? "BUSINESS_OWNER" : "USER",
      },
    });

    // 6. If it's a business account, create the Business and link to user
    if (userType === "business") {
      if (!businessName) {
        return NextResponse.json(
          { error: "Business name is required for business accounts" },
          { status: 400 }
        );
      }

      const emailDomain = email.split("@")[1]; // Extract domain from email

      // Create the Business and connect the owner
      const business = await prisma.business.create({
        data: {
          name: businessName,
          domain: emailDomain,
          owner: {
            connect: { id: user.id }, // ✅ link user as owner
          },
        },
      });

      // Update the user with the businessId (so they are tied to the Business)
      await prisma.user.update({
        where: { id: user.id },
        data: { businessId: business.id },
      });
    }

    // 7. Return success response
    return NextResponse.json({ message: "User created successfully" });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

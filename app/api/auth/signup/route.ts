// app/api/auth/signup/route.ts
//
// Purpose
// -------
// Securely create a new user (individual or business owner),
// hash their password, and optionally create a Business record.
// Business path captures both an internal unique handle (domain)
// and a human-display/enforcement domain (emailDomain).
//
// IMPORTANT:
// If you see Prisma error "The column `emailDomain` does not exist",
// run a migration so the DB matches prisma/schema.prisma (commands at bottom).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isStrongPassword } from "@/lib/validator";

function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function uniqueBusinessHandle(businessName: string, userId: string): string {
  const base = slugify(businessName) || "business";
  const suffix = (userId || "").slice(-6) || "member";
  return `${base}-${suffix}`;
}

function extractEmailDomain(email?: string): string | undefined {
  if (!email) return undefined;
  const at = email.indexOf("@");
  if (at < 0 || at === email.length - 1) return undefined;
  return email.slice(at + 1).toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    console.log("[API] Signup route hit with POST");

    // 1) Parse body
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

    // 3) Password strength
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

    // 5) Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6) Role & package
    const isBusiness = userType === "business";
    const role = isBusiness ? "BUSINESS_OWNER" : "USER";
    const packageType = isBusiness ? "business" : "individual";

    // 7) Create user first (so we can build a deterministic handle)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword,
        role,
        hasPaid: false,
        packageType,
      },
      select: { id: true, role: true },
    });

    console.log("[API] User created:", { id: user.id, role: user.role });

    // 8) Business path: create Business + link user in a single transaction
    if (role === "BUSINESS_OWNER") {
      if (!businessName?.trim()) {
        return NextResponse.json(
          { error: "Business name is required for business accounts." },
          { status: 400 }
        );
      }

      let internalHandle = uniqueBusinessHandle(businessName, user.id);
      const emailDomain = extractEmailDomain(email);

      try {
        await prisma.$transaction(async (tx) => {
          const business = await tx.business.create({
            data: {
              name: businessName.trim(),
              domain: internalHandle, // INTERNAL unique handle
              emailDomain,            // human-visible org email domain (e.g., "example.com")
              owner: { connect: { id: user.id } },
            },
            select: { id: true },
          });

          await tx.user.update({
            where: { id: user.id },
            data: { businessId: business.id },
          });
        });
      } catch (err: any) {
        // Handle rare unique collision on domain
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
          throw err;
        }
      }
    }

    // 9) Respond; client then signs in silently
    return NextResponse.json(
      { message: "User created successfully.", role: user.role, userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Signup error:", error);
    return NextResponse.json({ error: "Internal Server Error", systemError: true }, { status: 500 });
  }
}

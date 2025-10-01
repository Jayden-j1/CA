// app/api/auth/reset-password/route.ts
//
// Purpose:
// - Accept { token, password } and reset if token valid and not expired.
// - Canonical schema uses `expiresAt`, but we also handle legacy `expires`.
// - Enforces password strength server-side.
//
// Security:
// - Invalid/expired tokens are removed.
// - All reset tokens for the user are deleted after success (no reuse).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isStrongPassword } from "@/lib/validator";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    // 1) Input validation
    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    // 2) Enforce strong password rules (defense-in-depth)
    if (!isStrongPassword(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
        },
        { status: 400 }
      );
    }

    // 3) Retrieve token record — we do NOT use a strict select to remain compatible
    // across both `expiresAt` and legacy `expires` schemas.
    const record: any = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!record) {
      return NextResponse.json(
        { error: "Invalid or already used token" },
        { status: 400 }
      );
    }

    // 4) Compute expiry using either field
    const expiresValue: Date | null =
      record.expiresAt instanceof Date
        ? record.expiresAt
        : record.expires instanceof Date
        ? record.expires
        : null;

    if (!expiresValue) {
      // If neither field exists, treat as invalid
      await prisma.passwordResetToken.delete({ where: { token } });
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    // 5) Check expiration
    if (expiresValue <= new Date()) {
      await prisma.passwordResetToken.delete({ where: { token } });
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    // 6) Update user's password
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: record.userId },
      data: { hashedPassword },
    });

    // 7) Cleanup all reset tokens for this user (invalidate links)
    await prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ResetPassword] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

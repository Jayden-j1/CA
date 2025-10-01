// app/api/auth/reset-password/route.ts
//
// Purpose:
// - Accept { token, password } and reset the user's password if the token is valid.
// - Server-validates password strength before applying.
// - Uses Prisma model field `expires` (aligned with your schema).
//
// Security:
// - Deletes the reset token(s) after a successful reset so links cannot be reused.

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

    // 2) Server-side password strength check
    if (!isStrongPassword(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
        },
        { status: 400 }
      );
    }

    // 3) Find token
    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      // ✅ Per your error, the model has `expires` (not `expiresAt`)
      select: { id: true, userId: true, expires: true },
    });

    if (!record) {
      return NextResponse.json(
        { error: "Invalid or already used token" },
        { status: 400 }
      );
    }

    // 4) Check expiry using `expires`
    if (record.expires <= new Date()) {
      // Token expired → delete and inform client
      await prisma.passwordResetToken.delete({ where: { token } });
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    // 5) Hash new password and update
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: record.userId },
      data: { hashedPassword },
    });

    // 6) Clean up tokens (prevent reuse)
    await prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ResetPassword] Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

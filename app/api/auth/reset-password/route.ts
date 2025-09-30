// app/api/auth/reset-password/route.ts
//
// Purpose:
// - Accepts a token + new password, verifies token, updates the user's password,
//   deletes the token, and invalidates sessions.
// - Uses the same strong-password validator (lib/validator).
//
// Request:  POST { token: string, password: string }
// Response: 200 { ok: true } on success; 400/410 on invalid/expired token.
//
// Security:
// - Token is one-time use and expires.
// - All existing sessions for the user are invalidated on reset (logout everywhere).
//
// Note: We do not log sensitive values (password/token) in production.

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isStrongPassword } from "@/lib/validator";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    if (!isStrongPassword(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
        },
        { status: 400 }
      );
    }

    // 1) Lookup token
    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: { id: true, userId: true, expires: true },
    });

    if (!record) {
      // Token invalid: Do not reveal more info
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    // 2) Check expiration
    if (record.expires < new Date()) {
      // Cleanup
      await prisma.passwordResetToken.delete({ where: { token } });
      return NextResponse.json({ error: "Token expired" }, { status: 410 });
    }

    // 3) Hash new password and update user
    const hashed = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: record.userId },
      data: { hashedPassword: hashed },
    });

    // 4) Delete token (one-time use)
    await prisma.passwordResetToken.delete({ where: { token } });

    // 5) Invalidate all sessions for this user (logout everywhere)
    await prisma.session.deleteMany({
      where: { userId: record.userId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ResetPassword] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

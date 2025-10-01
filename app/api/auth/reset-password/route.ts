// app/api/auth/reset-password/route.ts
//
// Purpose:
// - Accepts token + new password.
// - Validates token expiry (uses `expires`, not `expiresAt`).
// - Hashes new password and updates user.
//
// Fix: replaced `expiresAt` with `expires`.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isStrongPassword } from "@/lib/validator";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Lookup token
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!resetToken || resetToken.expires < new Date()) {
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    // Validate password
    if (!isStrongPassword(password)) {
      return NextResponse.json(
        { error: "Password must include uppercase, lowercase, number, special char, min 8 chars." },
        { status: 400 }
      );
    }

    // Hash & update
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { hashedPassword },
    });

    // Cleanup token
    await prisma.passwordResetToken.delete({ where: { token } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ResetPassword] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

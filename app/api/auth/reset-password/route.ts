// app/api/auth/reset-password/route.ts
//
// Purpose
// -------
// Secure endpoint to complete a password reset. Accepts JSON:
//   { token: string, password: string }
//
// What changed in this patch
// --------------------------
// • We **removed** all references to legacy `expires` and now rely solely on
//   the canonical `expiresAt` field (Date).
// • We also **type-narrow** the Prisma query via `select` so TypeScript knows
//   exactly what fields are present (no `any`, no widening).
//
// Security
// --------
// • Strong password validation (server-side).
// • Tokens are invalidated (deleted) after use or if expired.
// • Responses avoid leaking user/token validity details.
//
// Pillars
// -------
// ✅ Efficiency   – 1 DB read, 1 update, 1 cleanup
// ✅ Robustness   – strict typing; consistent `expiresAt` only
// ✅ Simplicity   – no legacy branches
// ✅ Security     – defense-in-depth, minimal leakage
// ✅ Ease of mgmt – Prisma-based; small, clear code

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isStrongPassword } from "@/lib/validator";

export async function POST(req: Request) {
  try {
    // 1) Parse and validate body (shape-safe)
    const { token, password } = (await req.json()) as {
      token?: string;
      password?: string;
    };

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

    // 3) Retrieve the token record (canonical fields only)
    //
    // NOTE:
    //  - We select only what we need for both performance and type safety.
    //  - This route no longer supports legacy `expires`; only `expiresAt`.
    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: {
        userId: true,
        token: true,
        expiresAt: true,
      },
    });

    if (!record) {
      // Keep response generic to avoid leaking which check failed
      return NextResponse.json(
        { error: "Invalid or already used token" },
        { status: 400 }
      );
    }

    // 4) Validate expiration via canonical expiresAt
    if (!(record.expiresAt instanceof Date) || record.expiresAt <= new Date()) {
      // Either missing/invalid or expired → delete token defensively
      await prisma.passwordResetToken.delete({ where: { token } });
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    // 5) Hash and update password
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: record.userId },
      data: { hashedPassword },
    });

    // 6) Invalidate ALL reset tokens for this user (prevent reuse)
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

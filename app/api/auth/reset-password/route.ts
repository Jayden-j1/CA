// app/api/auth/reset-password/route.ts
//
// Purpose
// -------
// Secure endpoint to complete a password reset. Accepts JSON:
//   { token: string, password: string }
//
// What we fixed
// -------------
// • TypeScript error: your generated Prisma type only includes `expiresAt`,
//   so accessing `record.expires` raised a TS error. We now intentionally
//   widen the fetched record to `any` (docstring explains why) so we can
//   safely read either `expiresAt` (canonical) or legacy `expires` without
//   fighting Prisma’s generated types.
//
// Security
// --------
// • Strong password validation (server-side).
// • Tokens are invalidated (deleted) after use or if expired.
// • Responses avoid leaking user/token validity details.
//
// Pillars
// -------
// ✅ Efficiency   – single DB fetch + single user update + single cleanup
// ✅ Robustness   – supports legacy `expires` or canonical `expiresAt`
// ✅ Simplicity   – straightforward, self-contained logic
// ✅ Security     – defense-in-depth validations; minimal leakage
// ✅ Ease of mgmt – Prisma-based; clear comments and guards

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isStrongPassword } from "@/lib/validator";

export async function POST(req: Request) {
  try {
    // 1) Parse and validate body
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

    // 2) Enforce strong password server-side (defense-in-depth)
    if (!isStrongPassword(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
        },
        { status: 400 }
      );
    }

    // 3) Look up the token record.
    //
    // IMPORTANT: We deliberately annotate as `any` so we can read either
    // `expiresAt` (canonical in your current Prisma schema) or legacy `expires`
    // if old rows/columns exist. Without widening, TypeScript rejects `expires`.
    const record: any = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!record) {
      // Keep response generic to avoid leaking which check failed
      return NextResponse.json(
        { error: "Invalid or already used token" },
        { status: 400 }
      );
    }

    // 4) Resolve expiration using either field
    const expiresValue: Date | null =
      record.expiresAt instanceof Date
        ? record.expiresAt
        : record.expires instanceof Date
        ? record.expires
        : null;

    if (!expiresValue) {
      // No expiry present → treat as invalid and remove token defensively
      await prisma.passwordResetToken.delete({ where: { token } });
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    // 5) Expired?
    if (expiresValue <= new Date()) {
      await prisma.passwordResetToken.delete({ where: { token } });
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    // 6) Hash and update password
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: record.userId },
      data: { hashedPassword },
    });

    // 7) Invalidate ALL reset tokens for this user (prevent reuse)
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

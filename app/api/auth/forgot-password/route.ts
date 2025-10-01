// app/api/auth/forgot-password/route.ts
//
// Purpose:
// - Accept a user's email, issue a secure reset token, and send a password reset email.
// - Canonical schema uses `expiresAt` (DateTime).
// - To unblock deployments where Prisma Client or DB still use `expires`, we
//   add a compatibility fallback that writes `expires` instead.
//
// Security:
// - We never reveal whether an email exists (always return { ok: true }).
// - Tokens are random, single-use, and time-limited.
// - Email sending is centralized via lib/email/resendClient.ts.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendResetPasswordEmail } from "@/lib/email/resendClient";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    // 1) Validate input
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // 2) Lookup user (do not reveal existence)
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.isActive === false) {
      // Silent success prevents user enumeration
      return NextResponse.json({ ok: true });
    }

    // 3) Create secure token + expiry (1 hour from now)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // 4) Persist token — prefer `expiresAt`, but fall back to `expires` if needed
    try {
      // PRIMARY path: your schema shows `expiresAt`
      await prisma.passwordResetToken.create({
        data: {
          token,
          userId: user.id,
          // `as any` is used temporarily to compile even if Prisma Client types
          // are from an older schema. You can remove `as any` once your types are up-to-date.
          expiresAt: expiresDate,
        } as any,
      });
    } catch (e) {
      // FALLBACK path: some environments still use `expires`
      console.warn(
        "[ForgotPassword] Falling back to `expires` field (older schema). Please run Prisma migrate/generate."
      );
      await prisma.passwordResetToken.create({
        data: {
          token,
          userId: user.id,
          expires: expiresDate,
        } as any,
      });
    }

    // 5) Build reset URL for the email
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${token}`;

    // 6) Send email via centralized helper (Resend + React Email)
    await sendResetPasswordEmail({ to: email, resetUrl });

    // 7) Always respond ok
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ForgotPassword] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// app/api/auth/forgot-password/route.ts
//
// Purpose:
// - Accepts an email and issues a password reset link if valid.
// - Creates a PasswordResetToken row with `expires` field.
// - Sends email securely via Resend.
// - Always responds with { ok: true } if email invalid, to avoid leaking existence.
//
// Fixes:
// - Use exported helper `sendResetPasswordEmail` instead of raw `resend` (was not exported).
// - Aligns with Prisma schema: use `expires` (not `expiresAt`).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendResetPasswordEmail } from "@/lib/email/resendClient";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Lookup user
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return ok (don’t reveal user existence)
    if (!user || !user.isActive) {
      return NextResponse.json({ ok: true });
    }

    // Create secure random token (64 hex chars)
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    // Persist token
    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expires },
    });

    // Build URL
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${token}`;

    // Send reset email via central helper
    await sendResetPasswordEmail({ to: email, resetUrl });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ForgotPassword] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

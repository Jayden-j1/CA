// app/api/auth/forgot-password/route.ts
//
// Purpose:
// - Accept an email and issue a password-reset link if the user exists and is active.
// - Persist a PasswordResetToken with `expires` (DateTime) — this matches your schema.
// - Send an email using a centralized helper function (Resend + React Email).
// - Always return { ok: true } when the email is submitted to avoid user enumeration.
//
// Security:
// - Does not reveal whether an email exists.
// - Tokens are random and time-limited, and verified server-side in /reset-password.
//
// Notes:
// - This route is server-only; no client components here.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendResetPasswordEmail } from "@/lib/email/resendClient";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    // 1) Basic validation
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // 2) Look up user — do not leak existence in response
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      // ✅ Always return ok to prevent identifying valid accounts
      return NextResponse.json({ ok: true });
    }

    // 3) Create secure token (64 characters) with 1-hour expiry
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // 4) Store token in DB — IMPORTANT: your schema uses `expires`
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expires, // ✅ matches your schema
      },
    });

    // 5) Build reset URL for client to handle
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${token}`;

    // 6) Send email via centralized helper
    await sendResetPasswordEmail({ to: email, resetUrl });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ForgotPassword] Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

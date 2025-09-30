// app/api/auth/forgot-password/route.ts
//
// Purpose:
// - Accepts an email and (if it matches an active user) creates a reset token,
//   then sends a reset link via Resend.
// - Always responds with 200 + generic message (best practice) to avoid email enumeration.
//   (We still log internally for debugging.)
//
// Request:  POST  { email: string }
// Response: 200 OK { ok: true }
//           400/500 on malformed/system errors (only for dev mistakes).
//
// Security notes:
// - We never reveal whether the email exists.
// - Tokens expire (default 60 minutes).
// - We delete old tokens for the user before creating a new one (to keep things tidy).
//
// Required env:
// - NEXT_PUBLIC_APP_URL
// - RESEND_API_KEY
// - RESEND_FROM

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resend, RESEND_FROM } from "@/lib/resend";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Try to find an active user for this email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, isActive: true },
    });

    // Always proceed (do not reveal existence)
    if (!user || user.isActive === false) {
      // Return 200 anyway (best practice to avoid email enumeration)
      return NextResponse.json({ ok: true });
    }

    // Clean up existing tokens for this user (optional)
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Create a fresh token (expires in 60 minutes)
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 1000 * 60 * 60);

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expires,
      },
    });

    // Build reset link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password/${encodeURIComponent(token)}`;

    // Send email via Resend
    await resend.emails.send({
      from: RESEND_FROM,
      to: [normalizedEmail],
      subject: "Reset your password",
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.6">
          <h2>Reset your password</h2>
          <p>You (or someone else) requested a password reset for this account.</p>
          <p>If you did not request this, you can safely ignore this email.</p>
          <p>
            Click the button below to set a new password. This link expires in 60 minutes.
          </p>
          <p>
            <a href="${resetUrl}" style="display:inline-block; background:#2563eb; color:#fff; padding:10px 16px; border-radius:6px; text-decoration:none; font-weight:bold;">
              Reset Password
            </a>
          </p>
          <p>Or copy and paste this URL into your browser:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <hr />
          <p style="font-size:12px; color:#666;">If the button doesn’t work, use the link above.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ForgotPassword] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// app/api/auth/forgot-password/route.ts

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
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    // 4) Persist token in DB
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt, // ✅ must match your schema exactly
      },
    });

    // 5) Build reset URL
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${token}`;

    // 6) Send email
    await sendResetPasswordEmail({ to: email, resetUrl });

    // 7) Always respond ok
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ForgotPassword] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

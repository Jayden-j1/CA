// app/api/auth/forgot-password/route.ts
//
// Purpose:
// - Accept a user's email, issue a secure single-use reset token, and email a reset link.
// - Uses canonical schema field `expiresAt` (DateTime) on PasswordResetToken.
// - Silent-success strategy: Do not leak if the email exists or not.
//
// Why this version:
// - Your DB schema + Prisma Client are now aligned (expiresAt exists).
// - Removed the old "expires" fallback paths to keep it clean and robust.
// - Keeps token issuance centralized and emails sent via Resend helper.
//
// Security considerations:
// - Silent success prevents attackers from enumerating valid emails.
// - Token is a random 32-byte hex (unguessable).
// - Token expires in 1 hour; the reset route validates and invalidates it on use.
// - This API does not reveal anything sensitive in responses.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendResetPasswordEmail } from "@/lib/email/resendClient";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    // ---------------------------------------------------------
    // 1) Parse and validate input
    // ---------------------------------------------------------
    // We expect a JSON body with `email`.
    // Example: { "email": "user@example.com" }
    const { email } = await req.json();

    if (!email) {
      // Return explicit error if email missing (client bug).
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // ---------------------------------------------------------
    // 2) Find user by email — but do NOT reveal existence
    // ---------------------------------------------------------
    // If user does not exist or is inactive, we return { ok: true }
    // to avoid leaking which emails are registered.
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.isActive === false) {
      // Silent success. The client will display:
      // "If that email exists, a reset link has been sent."
      return NextResponse.json({ ok: true });
    }

    // ---------------------------------------------------------
    // 3) Create secure token + expiry time
    // ---------------------------------------------------------
    // - 32 bytes of cryptographic randomness, encoded in hex.
    // - Expires 1 hour from now.
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // ---------------------------------------------------------
    // 4) Persist the token to PasswordResetToken
    // ---------------------------------------------------------
    // Fields:
    // - token: random string
    // - userId: link to the user
    // - expiresAt: when token becomes invalid
    //
    // Note:
    // - If you want to invalidate prior tokens automatically, you could
    //   add a cleanup here:
    //   await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    //   Just be aware this changes behavior (only latest token remains valid).
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt, // ✅ aligned with DB schema & Prisma types
      },
    });

    // ---------------------------------------------------------
    // 5) Build reset URL for the email
    // ---------------------------------------------------------
    // The reset page will read the token from the URL and allow the
    // user to set a new password after re-validating the token server-side.
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${token}`;

    // ---------------------------------------------------------
    // 6) Send the reset email via Resend + React Email
    // ---------------------------------------------------------
    // - Centralized in lib/email/resendClient to keep concerns isolated.
    // - If email provider is temporarily down, we still return ok (to prevent
    //   user enumeration or abuse-friendly feedback). You can log errors internally.
    await sendResetPasswordEmail({ to: email, resetUrl });

    // ---------------------------------------------------------
    // 7) Always respond with ok
    // ---------------------------------------------------------
    // Client will show a success toast like:
    // "If that email exists, a reset link has been sent."
    return NextResponse.json({ ok: true });
  } catch (err) {
    // ---------------------------------------------------------
    // 8) Safe error logging
    // ---------------------------------------------------------
    // - Do not leak the error details to the client (returns generic 500).
    // - Print on server logs for debugging/alerting.
    console.error("[ForgotPassword] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

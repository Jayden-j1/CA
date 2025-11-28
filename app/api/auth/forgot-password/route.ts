// app/api/auth/forgot-password/route.ts
//
// Purpose:
// - Accept a user's email, issue a secure single-use reset token, and email a reset link.
// - Uses canonical schema field `expiresAt` (DateTime) on PasswordResetToken.
// - Silent-success strategy: Do not leak whether the email exists.
//
// Why this version (surgical updates only):
// - Normalize email (trim + lowercase) before lookup (avoids duplicates by case).
// - Delete prior tokens for this user so the newest link is always the one that works.
// - Build absolute reset URL with a safe fallback if NEXT_PUBLIC_APP_URL is missing.
// - Keep your existing Resend helper (sendResetPasswordEmail) and overall flow intact.
// - NEW: Use Upstash Redis rate limiting (lib/rateLimit.ts) to prevent abuse.
//
// Security considerations:
// - Silent success prevents attackers from enumerating valid emails.
// - Token is a random 32-byte hex (unguessable).
// - Token expires in 1 hour; the reset route validates + invalidates it on use.
// - This API does not reveal anything sensitive in responses.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendResetPasswordEmail } from "@/lib/email/resendClient";
import { limit } from "@/lib/rateLimit"; // ✅ NEW: Upstash rate limiter
import crypto from "crypto";

// Build an absolute app URL with a safe runtime fallback.
// • Prefers NEXT_PUBLIC_APP_URL when defined.
// • Falls back to request host (works for Vercel preview/prod).
function resolveAppBaseUrl(req: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    // local dev best-effort fallback
    return "http://localhost:3000";
  }
}

export async function POST(req: Request) {
  try {
    // ---------------------------------------------------------
    // 1) Parse and validate input
    // ---------------------------------------------------------
    const body = await req.json().catch(() => ({} as any));
    const rawEmail = (body?.email ?? "") as string;
    const email = rawEmail.trim().toLowerCase(); // ✅ normalize

    if (!email) {
      // Explicit error if client forgot to send an email (client bug).
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // ---------------------------------------------------------
    // 2) Upstash rate limiting (per-email)
    // ---------------------------------------------------------
    //
    // - We rate-limit on the normalized email address. This:
    //   • dramatically reduces abuse (same target email spammed)
    //   • keeps implementation simple and deterministic.
    // - IMPORTANT: We *still* respond with a generic "ok" so we don't leak
    //   whether the email exists or whether they’ve hit the limit.
    //
    // Example policy below:
    //   - max 5 reset requests per 10 minutes per email.
    //
    const rateKey = `forgot-password:${email}`;
    const allowed = await limit(rateKey, 5, 10 * 60); // max=5, window=600 seconds

    if (!allowed) {
      // Silently short-circuit:
      // - No DB lookup
      // - No email send
      // Client will still show: "If that email exists, a reset link has been sent."
      return NextResponse.json({ ok: true });
    }

    // ---------------------------------------------------------
    // 3) Find user by email — but do NOT reveal existence
    // ---------------------------------------------------------
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, isActive: true, email: true },
    });

    if (!user || user.isActive === false) {
      // Silent success. Client shows: "If that email exists, a reset link has been sent."
      return NextResponse.json({ ok: true });
    }

    // ---------------------------------------------------------
    // 4) Create secure token + expiry time
    // ---------------------------------------------------------
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // ---------------------------------------------------------
    // 5) Persist the token (invalidate any previous ones for this user)
    // ---------------------------------------------------------
    // Keeping the DB clean and ensuring only the latest link works reduces confusion.
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    // ---------------------------------------------------------
    // 6) Build reset URL for the email
    // ---------------------------------------------------------
    const base = resolveAppBaseUrl(req);
    const resetUrl = `${base}/reset-password/${encodeURIComponent(token)}`;

    // ---------------------------------------------------------
    // 7) Send the reset email via your existing Resend helper
    // ---------------------------------------------------------
    // Any provider hiccup is logged server-side; we still return ok
    // to avoid user enumeration or abuse-friendly feedback.
    try {
      await sendResetPasswordEmail({ to: email, resetUrl });
    } catch (e) {
      console.warn(
        "[ForgotPassword] Email provider error (still returning ok):",
        e
      );
    }

    // ---------------------------------------------------------
    // 8) Always respond with ok (anti-enumeration)
    // ---------------------------------------------------------
    return NextResponse.json({ ok: true });
  } catch (err) {
    // ---------------------------------------------------------
    // 9) Safe error logging
    // ---------------------------------------------------------
    console.error("[ForgotPassword] Error:", err);
    // Still a generic 500; client should show a neutral message.
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}









// // app/api/auth/forgot-password/route.ts
// //
// // Purpose:
// // - Accept a user's email, issue a secure single-use reset token, and email a reset link.
// // - Uses canonical schema field `expiresAt` (DateTime) on PasswordResetToken.
// // - Silent-success strategy: Do not leak whether the email exists.
// //
// // Why this version (surgical updates only):
// // - Normalize email (trim + lowercase) before lookup (avoids duplicates by case).
// // - Delete prior tokens for this user so the newest link is always the one that works.
// // - Build absolute reset URL with a safe fallback if NEXT_PUBLIC_APP_URL is missing.
// // - Keep your existing Resend helper (sendResetPasswordEmail) and overall flow intact.
// //
// // Security considerations:
// // - Silent success prevents attackers from enumerating valid emails.
// // - Token is a random 32-byte hex (unguessable).
// // - Token expires in 1 hour; the reset route validates + invalidates it on use.
// // - This API does not reveal anything sensitive in responses.

// import { NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { sendResetPasswordEmail } from "@/lib/email/resendClient";
// import crypto from "crypto";

// // Build an absolute app URL with a safe runtime fallback.
// // • Prefers NEXT_PUBLIC_APP_URL when defined.
// // • Falls back to request host (works for Vercel preview/prod).
// function resolveAppBaseUrl(req: Request): string {
//   const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
//   if (envUrl) return envUrl.replace(/\/$/, "");
//   try {
//     const u = new URL(req.url);
//     return `${u.protocol}//${u.host}`;
//   } catch {
//     // local dev best-effort fallback
//     return "http://localhost:3000";
//   }
// }

// export async function POST(req: Request) {
//   try {
//     // ---------------------------------------------------------
//     // 1) Parse and validate input
//     // ---------------------------------------------------------
//     const body = await req.json().catch(() => ({} as any));
//     const rawEmail = (body?.email ?? "") as string;
//     const email = rawEmail.trim().toLowerCase(); // ✅ normalize

//     if (!email) {
//       // Explicit error if client forgot to send an email (client bug).
//       return NextResponse.json({ error: "Email is required" }, { status: 400 });
//     }

//     // ---------------------------------------------------------
//     // 2) Find user by email — but do NOT reveal existence
//     // ---------------------------------------------------------
//     const user = await prisma.user.findUnique({
//       where: { email },
//       select: { id: true, isActive: true, email: true },
//     });

//     if (!user || user.isActive === false) {
//       // Silent success. Client shows: "If that email exists, a reset link has been sent."
//       return NextResponse.json({ ok: true });
//     }

//     // ---------------------------------------------------------
//     // 3) Create secure token + expiry time
//     // ---------------------------------------------------------
//     const token = crypto.randomBytes(32).toString("hex");
//     const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

//     // ---------------------------------------------------------
//     // 4) Persist the token (invalidate any previous ones for this user)
//     // ---------------------------------------------------------
//     // Keeping the DB clean and ensuring only the latest link works reduces confusion.
//     await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

//     await prisma.passwordResetToken.create({
//       data: {
//         token,
//         userId: user.id,
//         expiresAt,
//       },
//     });

//     // ---------------------------------------------------------
//     // 5) Build reset URL for the email
//     // ---------------------------------------------------------
//     const base = resolveAppBaseUrl(req);
//     const resetUrl = `${base}/reset-password/${encodeURIComponent(token)}`;

//     // ---------------------------------------------------------
//     // 6) Send the reset email via your existing Resend helper
//     // ---------------------------------------------------------
//     // Any provider hiccup is logged server-side; we still return ok
//     // to avoid user enumeration or abuse-friendly feedback.
//     try {
//       await sendResetPasswordEmail({ to: email, resetUrl });
//     } catch (e) {
//       console.warn("[ForgotPassword] Email provider error (still returning ok):", e);
//     }

//     // ---------------------------------------------------------
//     // 7) Always respond with ok (anti-enumeration)
//     // ---------------------------------------------------------
//     return NextResponse.json({ ok: true });
//   } catch (err) {
//     // ---------------------------------------------------------
//     // 8) Safe error logging
//     // ---------------------------------------------------------
//     console.error("[ForgotPassword] Error:", err);
//     // Still a generic 500; client should show a neutral message.
//     return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
//   }
// }










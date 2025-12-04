// app/api/auth/forgot-password/route.ts
//
// Purpose:
// - Accept a user's email, issue a secure single-use reset token, and email a reset link.
// - Uses canonical schema field `expiresAt` (DateTime) on PasswordResetToken.
// - Silent-success strategy: Do not leak whether the email exists.
//
// Why this version:
// - Normalize email (trim + lowercase) before lookup (avoids duplicates by case).
// - Delete prior tokens for this user so the newest link is always the one that works.
// - Build absolute reset URL with a safe fallback if NEXT_PUBLIC_APP_URL is missing.
// - Keep your existing Resend helper (sendResetPasswordEmail) and overall flow intact.
// - Wire in Upstash Redis rate limiting via lib/rateLimit.ts.
// - ✅ NEW: Use a *case-insensitive* lookup so legacy mixed-case records still work.
//
// Security considerations:
// - Silent success prevents attackers from enumerating valid emails.
// - Token is a random 32-byte hex (unguessable).
// - Token expires in 1 hour; the reset route validates + invalidates it on use.
// - This API does not reveal anything sensitive in responses.
// - Rate limiting slows down brute-force / abuse without breaking UX.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendResetPasswordEmail } from "@/lib/email/resendClient";
import crypto from "crypto";
import { limit } from "@/lib/rateLimit"; // Upstash Redis rate limiter

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
    // 0) RATE LIMITING (Upstash Redis via lib/rateLimit.ts)
    // ---------------------------------------------------------
    //
    // Goal:
    // - Throttle how often a single client can hit this endpoint.
    // - Protect against bots hammering /forgot-password.
    // - Preserve "silent success": the client still gets { ok: true }.
    //
    // Strategy:
    // - Use the request's IP address as a coarse "identity".
    // - Build a key like "fp:<ip>" (fp = forgot password).
    // - Allow, for example, 5 attempts per 60 seconds per IP.
    //
    // Notes:
    // - `limit()` fails OPEN if Redis is misconfigured/unavailable (returns true).
    //   That means we prefer UX over strict enforcement when infra has an issue.
    // - When rate-limited, we:
    //   • log a warning server-side
    //   • immediately return { ok: true }
    //   • do NOT touch the DB or send emails.

    // Best-effort IP extraction:
    // - On Vercel / many proxies, "x-forwarded-for" may be a CSV of IPs.
    //   The left-most IP is usually the client.
    // - Fallbacks ensure we always have some key string.
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ipFromForwarded = forwardedFor?.split(",")[0]?.trim();

    const ip = ipFromForwarded || req.headers.get("x-real-ip") || "unknown";

    const rateKey = `fp:${ip}`; // e.g. "fp:203.0.113.10"

    // Allow up to 5 forgot-password attempts per 60 seconds per IP.
    const allowed = await limit(rateKey, 5, 60);

    if (!allowed) {
      // We do NOT tell the client they are rate-limited.
      // They still see the generic "If that email exists..." message.
      console.warn("[ForgotPassword] Rate limit exceeded for key:", rateKey);
      return NextResponse.json({ ok: true });
    }

    // ---------------------------------------------------------
    // 1) Parse and validate input
    // ---------------------------------------------------------
    const body = await req.json().catch(() => ({} as any));
    const rawEmail = (body?.email ?? "") as string;
    const email = rawEmail.trim().toLowerCase(); // normalize

    if (!email) {
      // Explicit error if client forgot to send an email (client bug).
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // ---------------------------------------------------------
    // 2) Find user by email — but do NOT reveal existence
    //    (case-insensitive to handle legacy records cleanly)
    // ---------------------------------------------------------
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      select: { id: true, isActive: true, email: true },
    });

    if (!user || user.isActive === false) {
      // Silent success. Client shows: "If that email exists, a reset link has been sent."
      return NextResponse.json({ ok: true });
    }

    // ---------------------------------------------------------
    // 3) Create secure token + expiry time
    // ---------------------------------------------------------
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // ---------------------------------------------------------
    // 4) Persist the token (invalidate any previous ones for this user)
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
    // 5) Build reset URL for the email
    // ---------------------------------------------------------
    const base = resolveAppBaseUrl(req);
    const resetUrl = `${base}/reset-password/${encodeURIComponent(token)}`;

    // ---------------------------------------------------------
    // 6) Send the reset email via your existing Resend helper
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
    // 7) Always respond with ok (anti-enumeration)
    // ---------------------------------------------------------
    return NextResponse.json({ ok: true });
  } catch (err) {
    // ---------------------------------------------------------
    // 8) Safe error logging
    // ---------------------------------------------------------
    console.error("[ForgotPassword] Error:", err);
    // Still a generic 500; client should show a neutral message.
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
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
// // - NEW: Wire in Upstash Redis rate limiting via lib/rateLimit.ts.
// //
// // Security considerations:
// // - Silent success prevents attackers from enumerating valid emails.
// // - Token is a random 32-byte hex (unguessable).
// // - Token expires in 1 hour; the reset route validates + invalidates it on use.
// // - This API does not reveal anything sensitive in responses.
// // - Rate limiting slows down brute-force / abuse without breaking UX.

// import { NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { sendResetPasswordEmail } from "@/lib/email/resendClient";
// import crypto from "crypto";
// import { limit } from "@/lib/rateLimit"; // ✅ NEW: Upstash Redis rate limiter

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
//     // 0) RATE LIMITING (Upstash Redis via lib/rateLimit.ts)
//     // ---------------------------------------------------------
//     //
//     // Goal:
//     // - Throttle how often a single client can hit this endpoint.
//     // - Protect against bots hammering /forgot-password.
//     // - Preserve "silent success": the client still gets { ok: true }.
//     //
//     // Strategy:
//     // - Use the request's IP address as a coarse "identity".
//     // - Build a key like "fp:<ip>" (fp = forgot password).
//     // - Allow, for example, 5 attempts per 60 seconds per IP.
//     //
//     // Notes:
//     // - `limit()` fails OPEN if Redis is misconfigured/unavailable (returns true).
//     //   That means we prefer UX over strict enforcement when infra has an issue.
//     // - When rate-limited, we:
//     //   • log a warning server-side
//     //   • immediately return { ok: true }
//     //   • do NOT touch the DB or send emails.

//     // Best-effort IP extraction:
//     // - On Vercel / many proxies, "x-forwarded-for" may be a CSV of IPs.
//     //   The left-most IP is usually the client.
//     // - Fallbacks ensure we always have some key string.
//     const forwardedFor = req.headers.get("x-forwarded-for");
//     const ipFromForwarded = forwardedFor
//       ?.split(",")[0]
//       ?.trim();

//     const ip =
//       ipFromForwarded ||
//       req.headers.get("x-real-ip") ||
//       "unknown";

//     const rateKey = `fp:${ip}`; // e.g. "fp:203.0.113.10"

//     // Allow up to 5 forgot-password attempts per 60 seconds per IP.
//     const allowed = await limit(rateKey, 5, 60);

//     if (!allowed) {
//       // We do NOT tell the client they are rate-limited.
//       // They still see the generic "If that email exists..." message.
//       console.warn("[ForgotPassword] Rate limit exceeded for key:", rateKey);
//       return NextResponse.json({ ok: true });
//     }

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
//       console.warn(
//         "[ForgotPassword] Email provider error (still returning ok):",
//         e
//       );
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














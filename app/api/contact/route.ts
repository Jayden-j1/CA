// app/api/contact/route.ts
//
// Purpose
// -------
// Secure JSON endpoint for the public Contact form.
//
// Responsibilities:
// 1. Rate-limit requests (Upstash Redis via lib/rateLimit.ts).
// 2. Validate and normalise user input.
// 3. Call the email helper to deliver the message to your internal inbox.
// 4. Return only generic responses (no internal details or stack traces).
//
// Non-goals:
// - No coupling to authentication, payments, or course logic.
// - No persistence to the main database (this endpoint only sends an email).
//
// Pillars:
// - Security: header sanitisation + rate limiting + generic error messages.
// - Robustness: handles malformed JSON, missing fields, and provider failures.
// - Simplicity: small surface area; easy to audit and maintain.
// - Efficiency: uses your existing Upstash rate limiter and Resend client.

import { NextRequest, NextResponse } from "next/server";
import { limit } from "@/lib/rateLimit";
import { emailRegex } from "@/utils/emailValidation";
import {
  sendContactFormEmail,
  type ContactFormPayload,
} from "@/lib/email/contactFormEmail";

// -------- Helpers: extract IP + validate payload --------

/**
 * getClientIp
 * -----------
 * Best-effort extraction of the caller's IP address from common headers.
 * Used only as a key for rate limiting; we never return this to the client.
 */
function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // The first entry is usually the client's IP in a proxy chain.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // Fallback: anonymous bucket (still rate-limited as a group).
  return "unknown";
}

/**
 * validatePayload
 * ---------------
 * Validates the raw JSON body and returns either:
 * - { ok: true, value: ContactFormPayload } on success, or
 * - { ok: false, error: string } on validation error.
 *
 * This keeps the main POST handler small and easy to follow.
 */
function validatePayload(body: any): { ok: true; value: ContactFormPayload } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request body." };
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const mobileNumber = String(body.mobileNumber ?? "").trim();
  const phoneNumber = String(body.phoneNumber ?? "").trim();
  const preferredContact = String(body.preferredContact ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!name || name.length < 2) {
    return { ok: false, error: "Please provide your name." };
  }

  if (!email || !emailRegex.test(email)) {
    return { ok: false, error: "Please provide a valid email address." };
  }

  if (!message || message.length < 5) {
    return { ok: false, error: "Please enter a short message." };
  }

  // Optional: basic length caps to avoid extremely large inputs.
  if (name.length > 120 || email.length > 320) {
    return { ok: false, error: "Name or email is too long." };
  }
  if (mobileNumber.length > 32 || phoneNumber.length > 32) {
    return { ok: false, error: "Phone numbers are too long." };
  }

  let preferred: ContactFormPayload["preferredContact"] = undefined;
  if (preferredContact === "email" || preferredContact === "mobile" || preferredContact === "textMessage") {
    preferred = preferredContact;
  }

  return {
    ok: true,
    value: {
      name,
      email,
      mobileNumber: mobileNumber || undefined,
      phoneNumber: phoneNumber || undefined,
      preferredContact: preferred,
      message,
    },
  };
}

// -------- POST handler --------

export async function POST(req: NextRequest) {
  try {
    // 1) Rate-limit by IP to protect from automated spam.
    //    Here: max 5 requests per 10-minute window per IP.
    const ip = getClientIp(req);
    const allowed = await limit(`contact:${ip}`, 5, 10 * 60);

    if (!allowed) {
      // Do not reveal IP or internal details; just a generic 429.
      return NextResponse.json(
        { error: "Too many messages. Please try again later." },
        { status: 429 }
      );
    }

    // 2) Parse JSON body safely.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    // 3) Validate and normalise fields.
    const result = validatePayload(body);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // 4) Delegate to the email helper (single responsibility).
    await sendContactFormEmail(result.value);

    // 5) Generic success response (no internal info leaked).
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    // Server-side logging can include details for debugging.
    console.error("[Contact API] Unexpected error:", err);

    // But the client gets only a generic message.
    return NextResponse.json(
      { error: "Something went wrong while sending your message." },
      { status: 500 }
    );
  }
}

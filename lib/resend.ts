// lib/resend.ts
//
// Purpose:
// - Provides a single Resend client instance, configured from env.
// - Keeps email sending code centralized (e.g., for forgot-password).
//
// Required env vars:
// - RESEND_API_KEY
// - RESEND_FROM (e.g. "Support <no-reply@your-domain.com>")

import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  // Fail fast in dev; in production, logs at boot time.
  console.warn("[Resend] RESEND_API_KEY is not set. Forgot-password emails will fail.");
}

export const resend = new Resend(process.env.RESEND_API_KEY || "");
export const RESEND_FROM = process.env.RESEND_FROM || "Support <no-reply@example.com>";

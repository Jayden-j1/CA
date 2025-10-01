// lib/email/resendClient.ts
//
// Purpose:
// - Centralized helper for sending transactional emails.
// - Uses Resend API with React Email templates.
// - Renders React → HTML with @react-email/render.
// - Avoids Promise<string> issues by using `await render(...)`.
//
// Env vars:
// - RESEND_API_KEY
// - RESEND_FROM (e.g., "Support <no-reply@your-domain.com>")

import { Resend } from "resend";
import { render } from "@react-email/render";
import ResetPasswordEmail from "@/emails/ResetPasswordEmail";

// Instantiate client once
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * sendResetPasswordEmail
 * - Sends a password reset email.
 * - Renders the ResetPasswordEmail template into HTML + fallback text.
 */
export async function sendResetPasswordEmail(params: {
  to: string;
  resetUrl: string;
}) {
  const { to, resetUrl } = params;

  // Render React email template → HTML string
  const html = await render(
    ResetPasswordEmail({
      resetUrl,
      productName: "Cultural Awareness App",
      supportEmail: "support@your-domain.com",
    })
  );

  // Plain text fallback
  const text = `Reset your password here: ${resetUrl}`;

  // Send with Resend
  await resend.emails.send({
    from: process.env.RESEND_FROM || "no-reply@your-domain.com",
    to,
    subject: "Reset your password",
    html,
    text,
  });
}

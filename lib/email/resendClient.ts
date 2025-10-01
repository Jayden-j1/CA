// lib/email/resendClient.ts
//
// Purpose:
// - Central helper to render and send transactional emails via Resend.
// - Keeps API routes lean and consistent.
//
// Env:
// - RESEND_API_KEY
// - RESEND_FROM (e.g. "Support <no-reply@your-domain.com>")

import { Resend } from "resend";
import { render } from "@react-email/render";
import ResetPasswordEmail from "@/emails/ResetPasswordEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendResetPasswordEmail(params: {
  to: string;
  resetUrl: string;
}) {
  const { to, resetUrl } = params;

  // Render React Email template to HTML
  const html = await render(
    ResetPasswordEmail({
      resetUrl,
      productName: "Cultural Awareness App",
      supportEmail: "support@your-domain.com",
    })
  );

  const text = `Reset your password: ${resetUrl}`;

  await resend.emails.send({
    from: process.env.RESEND_FROM || "no-reply@your-domain.com",
    to,
    subject: "Reset your password",
    html, // ✅ string
    text,
  });
}

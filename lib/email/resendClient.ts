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
import StaffWelcomeEmail from "@/emails/StaffWelcomeEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * sanitizeRecipient:
 * ------------------
 * Defensive layer to ensure the "to" field:
 * - is trimmed
 * - does NOT contain CR/LF characters which could be abused for
 *   header injection in some email systems.
 *
 * In normal flows, `to` comes from:
 * - a validated user email in the database, or
 * - validated owner input on staff creation.
 *
 * This function protects against edge cases and future regressions.
 */
function sanitizeRecipient(to: string): string {
  const trimmed = (to || "").trim();

  // Reject empty recipient
  if (!trimmed) {
    throw new Error("Invalid recipient address (empty).");
  }

  // Reject CR/LF characters to avoid header injection vectors
  if (/[\r\n]/.test(trimmed)) {
    throw new Error("Invalid recipient address (contains newline).");
  }

  return trimmed;
}

/**
 * Forgot-password flow:
 * ---------------------
 * Send a reset-link email for password recovery.
 */
export async function sendResetPasswordEmail(params: {
  to: string;
  resetUrl: string;
}) {
  const { to, resetUrl } = params;

  // Defensive sanitisation of the recipient address
  const recipient = sanitizeRecipient(to);

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
    to: recipient,
    subject: "Reset your password",
    html, // ✅ string
    text,
  });
}

/**
 * Staff welcome flow:
 * -------------------
 * When a BUSINESS_OWNER or ADMIN creates a staff member via /api/staff/create,
 * we send the staff user an email that includes:
 *  - a friendly welcome message,
 *  - their temporary password (set by the owner/admin),
 *  - and a direct login URL.
 *
 * This relieves the owner/admin from manually emailing credentials.
 *
 * NOTE:
 *  - The staff user is still forced to change this password on first login.
 */
export async function sendStaffWelcomeEmail(params: {
  to: string;
  name?: string;
  temporaryPassword: string;
  loginUrl: string;
}) {
  const { to, name, temporaryPassword, loginUrl } = params;

  // Defensive sanitisation of the recipient address
  const recipient = sanitizeRecipient(to);

  // Render React Email template to HTML
  const html = await render(
    StaffWelcomeEmail({
      name,
      temporaryPassword,
      loginUrl,
      productName: "Nyangbul Cultural Awareness Training",
      supportEmail: "support@your-domain.com",
    })
  );

  const text = [
    `You have been added as a staff user for Nyangbul Cultural Awareness Training.`,
    ``,
    `Login URL: ${loginUrl}`,
    `Temporary password: ${temporaryPassword}`,
    ``,
    `You will be prompted to change this password after your first login.`,
  ].join("\n");

  await resend.emails.send({
    from: process.env.RESEND_FROM || "no-reply@your-domain.com",
    to: recipient,
    subject: "Your staff account for Nyangbul Cultural Awareness Training",
    html,
    text,
  });
}









// // lib/email/resendClient.ts
// //
// // Purpose:
// // - Central helper to render and send transactional emails via Resend.
// // - Keeps API routes lean and consistent.
// //
// // Env:
// // - RESEND_API_KEY
// // - RESEND_FROM (e.g. "Support <no-reply@your-domain.com>")

// import { Resend } from "resend";
// import { render } from "@react-email/render";
// import ResetPasswordEmail from "@/emails/ResetPasswordEmail";
// import StaffWelcomeEmail from "@/emails/StaffWelcomeEmail";

// const resend = new Resend(process.env.RESEND_API_KEY);

// /**
//  * Forgot-password flow:
//  * ---------------------
//  * Send a reset-link email for password recovery.
//  */
// export async function sendResetPasswordEmail(params: {
//   to: string;
//   resetUrl: string;
// }) {
//   const { to, resetUrl } = params;

//   // Render React Email template to HTML
//   const html = await render(
//     ResetPasswordEmail({
//       resetUrl,
//       productName: "Cultural Awareness App",
//       supportEmail: "support@your-domain.com",
//     })
//   );

//   const text = `Reset your password: ${resetUrl}`;

//   await resend.emails.send({
//     from: process.env.RESEND_FROM || "no-reply@your-domain.com",
//     to,
//     subject: "Reset your password",
//     html, // ✅ string
//     text,
//   });
// }

// /**
//  * Staff welcome flow:
//  * -------------------
//  * When a BUSINESS_OWNER or ADMIN creates a staff member via /api/staff/create,
//  * we send the staff user an email that includes:
//  *  - a friendly welcome message,
//  *  - their temporary password (set by the owner/admin),
//  *  - and a direct login URL.
//  *
//  * This relieves the owner/admin from manually emailing credentials.
//  *
//  * NOTE:
//  *  - The staff user is still forced to change this password on first login.
//  */
// export async function sendStaffWelcomeEmail(params: {
//   to: string;
//   name?: string;
//   temporaryPassword: string;
//   loginUrl: string;
// }) {
//   const { to, name, temporaryPassword, loginUrl } = params;

//   // Render React Email template to HTML
//   const html = await render(
//     StaffWelcomeEmail({
//       name,
//       temporaryPassword,
//       loginUrl,
//       productName: "Nyangbul Cultural Awareness Training",
//       supportEmail: "support@your-domain.com",
//     })
//   );

//   const text = [
//     `You have been added as a staff user for Nyangbul Cultural Awareness Training.`,
//     ``,
//     `Login URL: ${loginUrl}`,
//     `Temporary password: ${temporaryPassword}`,
//     ``,
//     `You will be prompted to change this password after your first login.`,
//   ].join("\n");

//   await resend.emails.send({
//     from: process.env.RESEND_FROM || "no-reply@your-domain.com",
//     to,
//     subject: "Your staff account for Nyangbul Cultural Awareness Training",
//     html,
//     text,
//   });
// }


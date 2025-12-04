// lib/email/contactFormEmail.ts
//
// Purpose
// -------
// Centralised helper for sending contact-form submissions via Resend.
//
// Design goals:
// - Keep API routes lean: route calls this helper and handles HTTP concerns only.
// - Reuse your existing Resend client from lib/resend.ts (single source of truth).
// - Apply defensive sanitisation to all header-like fields (from / to / subject).
// - Keep body length bounded to avoid abuse.
// - Escape user-provided content before inserting into HTML.
//
// Env requirements:
// - RESEND_API_KEY      (already used by lib/resend.ts)
// - RESEND_FROM         (already used by lib/resend.ts)
// - CONTACT_FORM_TO     (NEW, recommended; where contact messages are delivered)
//     e.g. "Nyangbul Cultural Awareness <contact@your-domain.com>"
//
// Fallback behaviour:
// - If CONTACT_FORM_TO is not set, we fall back to RESEND_FROM.
// - If neither is set, we throw (and the API route returns 500 with a generic error).

import { resend, RESEND_FROM } from "@/lib/resend";
import { emailRegex } from "@/utils/emailValidation"; // ✅ reuse existing email validator

// ----------------- Internal sanitisation helpers -----------------

/**
 * sanitizeHeaderValue
 * -------------------
 * Defensive sanitisation for any value that will be placed into an
 * email header field (e.g., "to", "from", "replyTo", "subject").
 *
 * Protections:
 * - Trims leading/trailing whitespace.
 * - Rejects empty values.
 * - Rejects any CR/LF characters to avoid header-injection vectors.
 */
function sanitizeHeaderValue(
  raw: string | undefined | null,
  fieldName: string
): string {
  const value = (raw ?? "").trim();

  if (!value) {
    // Throw so the API route can catch and respond with a generic error.
    throw new Error(`Invalid ${fieldName}: value is empty.`);
  }

  // Disallow newline characters in header fields.
  if (/[\r\n]/.test(value)) {
    throw new Error(`Invalid ${fieldName}: unexpected newline characters.`);
  }

  return value;
}

/**
 * sanitizeBody
 * ------------
 * Sanitize and bound arbitrary text that will be rendered in the email body.
 * - Strips carriage returns (\r) to normalise newlines.
 * - Trims leading/trailing whitespace.
 * - Truncates to a maximum length to avoid giant payloads.
 *
 * NOTE:
 * - This does NOT perform HTML escaping. That is handled separately by escapeHtml().
 */
function sanitizeBody(
  raw: string | undefined | null,
  maxLength: number
): string {
  const normalised = (raw ?? "").replace(/\r/g, "");
  const trimmed = normalised.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength) + "\n\n[truncated]";
}

/**
 * escapeHtml
 * ----------
 * Escape user-controlled text before injecting into an HTML string.
 *
 * Why:
 * - Prevents a visitor from breaking the structure of the email by including
 *   characters like `<` or `"` which could otherwise be interpreted as HTML.
 * - Even though this email goes to your own mailbox, sanitising is a good
 *   defensive habit and prevents surprises when content is forwarded.
 */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ----------------- Public helper: sendContactFormEmail -----------------

export interface ContactFormPayload {
  name: string;
  email: string; // user’s email address (reply-to)
  mobileNumber?: string; // optional mobile
  phoneNumber?: string; // optional landline
  preferredContact?: "email" | "mobile" | "textMessage" | string;
  message: string;
}

/**
 * sendContactFormEmail
 * --------------------
 * Sends a single email to your internal contact address when a visitor
 * submits the public contact form.
 *
 * The visitor is NOT emailed directly. Instead:
 * - "to"      → your internal contact mailbox (CONTACT_FORM_TO or RESEND_FROM).
 * - "from"    → RESEND_FROM (as required by most providers).
 * - "replyTo" → visitor's email, so you can simply hit "Reply" in your inbox.
 */
export async function sendContactFormEmail(
  payload: ContactFormPayload
): Promise<void> {
  // -------------------------------------------------------------
  // 1) Resolve and sanitise header recipients
  // -------------------------------------------------------------

  // Internal recipient (site owner / support mailbox).
  // - Prefer a dedicated CONTACT_FORM_TO inbox.
  // - Fall back to RESEND_FROM if not set.
  const internalToRaw =
    process.env.CONTACT_FORM_TO ||
    RESEND_FROM; // fall back to existing from-address if dedicated inbox not set

  const to = sanitizeHeaderValue(
    internalToRaw,
    "CONTACT_FORM_TO / RESEND_FROM"
  );

  // Visitor's email used as reply-to.
  // First enforce a minimal syntactic check using your existing emailRegex
  // (defence in depth on top of frontend validation).
  const trimmedEmail = (payload.email || "").trim();
  if (!emailRegex.test(trimmedEmail)) {
    throw new Error("Invalid reply-to email: does not match expected pattern.");
  }

  const replyTo = sanitizeHeaderValue(trimmedEmail, "reply-to email");

  // -------------------------------------------------------------
  // 2) Sanitize body fields (name, phones, message, etc.)
  // -------------------------------------------------------------

  // Name is only used in subject/body, but we still trim and bound it.
  const safeName = sanitizeBody(
    payload.name || "Unknown visitor",
    120 /* characters */
  );

  // Preferred contact method is optional; keep it short.
  const preferred =
    payload.preferredContact && payload.preferredContact.length <= 32
      ? payload.preferredContact
      : "not specified";

  const safeMobile = sanitizeBody(payload.mobileNumber ?? "", 32);
  const safePhone = sanitizeBody(payload.phoneNumber ?? "", 32);
  const safeMessage = sanitizeBody(
    payload.message,
    5000 /* cap message length */
  );

  const subject = sanitizeHeaderValue(
    `[Contact Form] ${safeName}`,
    "email subject"
  );

  // -------------------------------------------------------------
  // 3) HTML + text rendering with HTML escaping for user content
  // -------------------------------------------------------------

  // Escape all user-controlled fields before embedding into HTML.
  const nameHtml = escapeHtml(safeName);
  const replyToHtml = escapeHtml(replyTo);
  const preferredHtml = escapeHtml(preferred);
  const mobileHtml = safeMobile ? escapeHtml(safeMobile) : "";
  const phoneHtml = safePhone ? escapeHtml(safePhone) : "";
  const messageHtml = escapeHtml(safeMessage);

  // Simple HTML body – you can later replace this with a React Email template
  // without changing the route that calls this helper.
  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5;">
      <h1 style="font-size: 18px; margin-bottom: 12px;">New contact form submission</h1>

      <p><strong>Name:</strong> ${nameHtml}</p>
      <p><strong>Email:</strong> ${replyToHtml}</p>
      <p><strong>Preferred contact method:</strong> ${preferredHtml}</p>

      ${
        mobileHtml
          ? `<p><strong>Mobile:</strong> ${mobileHtml}</p>`
          : ""
      }
      ${
        phoneHtml
          ? `<p><strong>Phone:</strong> ${phoneHtml}</p>`
          : ""
      }

      <hr style="margin: 16px 0;" />

      <p><strong>Message:</strong></p>
      <pre style="
        white-space: pre-wrap;
        background: #f9fafb;
        padding: 12px;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      ">${messageHtml}</pre>
    </div>
  `;

  const textLines: string[] = [
    `New contact form submission`,
    ``,
    `Name: ${safeName}`,
    `Email: ${replyTo}`,
    `Preferred contact method: ${preferred}`,
  ];

  if (safeMobile) textLines.push(`Mobile: ${safeMobile}`);
  if (safePhone) textLines.push(`Phone: ${safePhone}`);

  textLines.push("", "Message:", safeMessage);

  const text = textLines.join("\n");

  // -------------------------------------------------------------
  // 4) Finally, send via Resend.
  // -------------------------------------------------------------
  //
  // IMPORTANT:
  // - Resend's Node SDK expects `replyTo` (camelCase), not `reply_to`.
  //   Using `reply_to` causes the TS error you observed:
  //   "Object literal may only specify known properties, but 'reply_to' does not exist..."
  await resend.emails.send({
    from: RESEND_FROM,
    to,
    replyTo, // ✅ fixed property name, matches CreateEmailOptions
    subject,
    html,
    text,
  });
}









// // lib/email/contactFormEmail.ts
// //
// // Purpose
// // -------
// // Centralised helper for sending contact-form submissions via Resend.
// //
// // Design goals:
// // - Keep API routes lean: route calls this helper and handles HTTP concerns only.
// // - Reuse your existing Resend client from lib/resend.ts (single source of truth).
// // - Apply defensive sanitisation to all header-like fields (from / to / subject).
// // - Keep body length bounded to avoid abuse.
// //
// // Env requirements:
// // - RESEND_API_KEY      (already used by lib/resend.ts)
// // - RESEND_FROM         (already used by lib/resend.ts)
// // - CONTACT_FORM_TO     (NEW, recommended; where contact messages are delivered)
// //     e.g. "Nyangbul Cultural Awareness <contact@your-domain.com>"
// //
// // Fallback behaviour:
// // - If CONTACT_FORM_TO is not set, we fall back to RESEND_FROM.
// // - If neither is set, we throw (and the API route returns 500 with a generic error).

// import { resend, RESEND_FROM } from "@/lib/resend";

// // ----------------- Internal sanitisation helpers -----------------

// /**
//  * sanitizeHeaderValue
//  * -------------------
//  * Defensive sanitisation for any value that will be placed into an
//  * email header field (e.g., "to", "from", "reply_to", "subject").
//  *
//  * Protections:
//  * - Trims leading/trailing whitespace.
//  * - Rejects empty values.
//  * - Rejects any CR/LF characters to avoid header-injection vectors.
//  */
// function sanitizeHeaderValue(raw: string | undefined | null, fieldName: string): string {
//   const value = (raw ?? "").trim();

//   if (!value) {
//     throw new Error(`Invalid ${fieldName}: value is empty.`);
//   }

//   // Disallow newline characters in header fields.
//   if (/[\r\n]/.test(value)) {
//     throw new Error(`Invalid ${fieldName}: unexpected newline characters.`);
//   }

//   return value;
// }

// /**
//  * sanitizeBody
//  * ------------
//  * Sanitize and bound arbitrary text that will be rendered in the email body.
//  * - Strips carriage returns (\r) to normalise newlines.
//  * - Trims leading/trailing whitespace.
//  * - Truncates to a maximum length to avoid giant payloads.
//  */
// function sanitizeBody(raw: string | undefined | null, maxLength: number): string {
//   const normalised = (raw ?? "").replace(/\r/g, "");
//   const trimmed = normalised.trim();
//   if (trimmed.length <= maxLength) return trimmed;
//   return trimmed.slice(0, maxLength) + "\n\n[truncated]";
// }

// // ----------------- Public helper: sendContactFormEmail -----------------

// export interface ContactFormPayload {
//   name: string;
//   email: string;           // user’s email address (reply-to)
//   mobileNumber?: string;   // optional mobile
//   phoneNumber?: string;    // optional landline
//   preferredContact?: "email" | "mobile" | "textMessage" | string;
//   message: string;
// }

// /**
//  * sendContactFormEmail
//  * --------------------
//  * Sends a single email to your internal contact address when a visitor
//  * submits the public contact form.
//  *
//  * The visitor is NOT emailed directly. Instead:
//  * - "to"      → your internal contact mailbox (CONTACT_FORM_TO or RESEND_FROM).
//  * - "from"    → RESEND_FROM (as required by most providers).
//  * - "replyTo" → visitor's email, so you can simply hit "Reply" in your inbox.
//  */
// export async function sendContactFormEmail(payload: ContactFormPayload): Promise<void> {
//   // Resolve the internal recipient (site owner / support mailbox).
//   const internalToRaw =
//     process.env.CONTACT_FORM_TO ||
//     RESEND_FROM; // fall back to existing from-address if dedicated inbox not set

//   const to = sanitizeHeaderValue(internalToRaw, "CONTACT_FORM_TO / RESEND_FROM");

//   // Sanitise visitor's email for Reply-To.
//   const replyTo = sanitizeHeaderValue(payload.email, "reply-to email");

//   // Name is only used in subject/body, but we still trim and bound it.
//   const safeName = sanitizeBody(payload.name || "Unknown visitor", 120);

//   // Preferred contact method is optional; keep it short.
//   const preferred =
//     payload.preferredContact && payload.preferredContact.length <= 32
//       ? payload.preferredContact
//       : "not specified";

//   const safeMobile = sanitizeBody(payload.mobileNumber ?? "", 32);
//   const safePhone = sanitizeBody(payload.phoneNumber ?? "", 32);
//   const safeMessage = sanitizeBody(payload.message, 5000); // cap message length

//   const subject = sanitizeHeaderValue(
//     `[Contact Form] ${safeName}`,
//     "email subject"
//   );

//   // Simple HTML body – you can later replace this with a React Email template
//   // without changing the route that calls this helper.
//   const html = `
//     <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5;">
//       <h1 style="font-size: 18px; margin-bottom: 12px;">New contact form submission</h1>

//       <p><strong>Name:</strong> ${safeName}</p>
//       <p><strong>Email:</strong> ${replyTo}</p>
//       <p><strong>Preferred contact method:</strong> ${preferred}</p>

//       ${
//         safeMobile
//           ? `<p><strong>Mobile:</strong> ${safeMobile}</p>`
//           : ""
//       }
//       ${
//         safePhone
//           ? `<p><strong>Phone:</strong> ${safePhone}</p>`
//           : ""
//       }

//       <hr style="margin: 16px 0;" />

//       <p><strong>Message:</strong></p>
//       <pre style="
//         white-space: pre-wrap;
//         background: #f9fafb;
//         padding: 12px;
//         border-radius: 6px;
//         border: 1px solid #e5e7eb;
//         font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
//       ">${safeMessage}</pre>
//     </div>
//   `;

//   const textLines: string[] = [
//     `New contact form submission`,
//     ``,
//     `Name: ${safeName}`,
//     `Email: ${replyTo}`,
//     `Preferred contact method: ${preferred}`,
//   ];

//   if (safeMobile) textLines.push(`Mobile: ${safeMobile}`);
//   if (safePhone) textLines.push(`Phone: ${safePhone}`);

//   textLines.push("", "Message:", safeMessage);

//   const text = textLines.join("\n");

//   // Finally, send via Resend.
//   await resend.emails.send({
//     from: RESEND_FROM,
//     to,
//     reply_to: replyTo,
//     subject,
//     html,
//     text,
//   });
// }

// lib/email/corporate.ts
//
// Tiny helper to block common free/vendor mailbox domains when adding staff.
// Call this from your "add-staff" API before creating the user.

const PUBLIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
  'msn.com', 'yahoo.com', 'yahoo.com.au', 'icloud.com', 'me.com', 'aol.com',
  'proton.me', 'protonmail.com', 'zoho.com', 'gmx.com', 'yandex.com', 'mail.com'
]);

export function extractEmailDomain(email: string): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at <= 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

export function isPublicMailboxDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  return PUBLIC_DOMAINS.has(domain);
}

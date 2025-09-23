// utils/emailValidation.ts

// --- Email validation helpers ---
// Regex for flexible email validation
// - Supports custom domains
// - Requires at least one dot in domain
// - TLD must be 2–15 characters long
export const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,15}$/;

// Common domains to suggest if typos or partial domains are detected
const commonDomains = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "protonmail.com",
  "aol.com",
  "live.com",
];

// --- Levenshtein distance algorithm (edit distance) ---
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[a.length][b.length];
}

// --- Suggest closest or matching domain ---
//
// Enhancements:
// 1. If domain exactly matches a common domain → no suggestion.
// 2. If domain is within 2 edits of a common domain → suggest it.
// 3. If user types at least 3 chars that match the start of a common domain → suggest it.
// 4. If only "name@" is typed → default suggest Gmail.
export function suggestDomain(email: string) {
  const parts = email.split("@");
  if (parts.length !== 2) return null;

  const [local, domain] = parts;

  // 1. Already correct → no suggestion
  if (commonDomains.includes(domain)) return null;

  // 2. Close typo → suggest
  const typoSuggestion = commonDomains.find(
    (d) => levenshteinDistance(domain, d) <= 2
  );
  if (typoSuggestion) return `${local}@${typoSuggestion}`;

  // 3. Prefix suggestion: if first 3+ chars match start of a common domain
  if (domain.length >= 3) {
    const prefixSuggestion = commonDomains.find((d) =>
      d.startsWith(domain.toLowerCase())
    );
    if (prefixSuggestion) return `${local}@${prefixSuggestion}`;
  }

  // 4. Empty domain → suggest Gmail
  if (domain === "") return `${local}@gmail.com`;

  return null;
}

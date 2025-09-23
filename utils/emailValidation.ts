// utils/emailValidation.ts
//
// Purpose:
// Centralized email validation + suggestion helpers
// Used in forms (ContactForm, SignupForm) and tested in Jest

// Regex for flexible email validation
// - Supports custom domains
// - Requires at least one dot in domain
// - TLD must be 2–15 characters long
export const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,15}$/;

// Common domains to suggest if typos detected
const commonDomains = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "protonmail.com",
  "aol.com",
  "live.com"
];

// Levenshtein distance algorithm (edit distance)
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
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

// Suggest closest common domain if a typo is detected
export function suggestDomain(email: string) {
  const parts = email.split("@");
  if (parts.length !== 2) return null;

  const [local, domain] = parts;

  if (commonDomains.includes(domain)) return null;

  const typoSuggestion = commonDomains.find(
    (d) => levenshteinDistance(domain, d) <= 2
  );
  if (typoSuggestion) return `${local}@${typoSuggestion}`;

  if (domain === "") return `${local}@gmail.com`;

  return null;
}

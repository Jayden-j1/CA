// lib/validator.ts
//
// Purpose:
// - Central place to keep simple, consistent validators.
// - Strong password rule used by signup + reset-password.
//
// Rule:
// - Min length: 8
// - At least 1 uppercase letter
// - At least 1 lowercase letter
// - At least 1 number
// - At least 1 special character

export function isStrongPassword(pw: string): boolean {
  if (!pw || pw.length < 8) return false;

  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  const hasSpecial = /[ !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(pw);

  return hasUpper && hasLower && hasNumber && hasSpecial;
}

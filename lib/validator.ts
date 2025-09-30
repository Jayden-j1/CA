// lib/validators.ts
//
// Purpose:
// - Central place for custom validators (like password complexity).
// - Keeps rules consistent between signup, staff add, and future reset-password.
//
// Why regex?
// - Simple, fast, widely supported.
// - Easy to adjust rules later (e.g., minimum length).

/**
 * Validate password complexity.
 * Rules:
 * - Min 8 chars
 * - At least 1 uppercase
 * - At least 1 lowercase
 * - At least 1 number
 * - At least 1 special char
 *
 * Returns: true if valid, false otherwise.
 */
export function isStrongPassword(password: string): boolean {
  const complexityRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  return complexityRegex.test(password);
}

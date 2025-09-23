// __tests__/emailValidation.test.ts
//
// Purpose of this test file:
// - Verify that our emailRegex correctly identifies valid and invalid emails.
// - Verify that suggestDomain() provides useful domain corrections and suggestions.
// - Ensure custom domains are supported and not overridden by suggestions.

import { describe, expect, test } from "@jest/globals"; 
// Import Jest globals explicitly (works well with ESM and Next.js projects).
// "describe" groups related tests, "test" defines individual test cases,
// and "expect" is used to assert expected outcomes.

import { emailRegex, suggestDomain } from "@/utils/emailValidation";
// Import the functions we are testing from our shared utility file.

// --- Test suite for emailRegex ---
describe("emailRegex validation", () => {
  test("valid emails pass", () => {
    // Expect true for common valid formats
    expect(emailRegex.test("user@gmail.com")).toBe(true);
    expect(emailRegex.test("user.name+tag@company.co.uk")).toBe(true);
    expect(emailRegex.test("first.last@sub.domain.org")).toBe(true);
  });

  test("invalid emails fail", () => {
    // Expect false for invalid formats
    expect(emailRegex.test("plainaddress")).toBe(false); // no "@" symbol
    expect(emailRegex.test("user@domain")).toBe(false); // missing TLD
    expect(emailRegex.test("user@domain.")).toBe(false); // trailing dot in domain
    expect(emailRegex.test("@missinglocal.com")).toBe(false); // missing local part
  });
});

// --- Test suite for suggestDomain ---
describe("suggestDomain", () => {
  test("returns null for valid common domains", () => {
    // If the email domain is already correct, no suggestion should be made
    expect(suggestDomain("user@gmail.com")).toBe(null);
    expect(suggestDomain("user@outlook.com")).toBe(null);
  });

  test("suggests correction for close typos", () => {
    // Common typos should be auto-corrected using Levenshtein distance
    expect(suggestDomain("user@gmial.com")).toBe("user@gmail.com");
    expect(suggestDomain("user@outlok.com")).toBe("user@outlook.com");
  });

  test("suggests based on prefix match (≥3 chars)", () => {
    // Partial prefixes should suggest common domains
    expect(suggestDomain("user@gma")).toBe("user@gmail.com");
    expect(suggestDomain("user@out")).toBe("user@outlook.com");
    expect(suggestDomain("user@hot")).toBe("user@hotmail.com");
  });

  test("suggests gmail if domain missing", () => {
    // If no domain is entered after "@", fallback to gmail.com
    expect(suggestDomain("user@")).toBe("user@gmail.com");
  });

  test("does not interfere with custom domains", () => {
    // Custom domains should not be modified by suggestions
    expect(suggestDomain("user@mycompany.com")).toBe(null);
    expect(emailRegex.test("user@mycompany.com")).toBe(true);
  });
});

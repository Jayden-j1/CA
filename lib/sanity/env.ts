// lib/sanity/env.ts
//
// Purpose
// -------
// Centralize and validate all Sanity-related environment variables.
// We export both individual constants (projectId, dataset, apiVersion)
// AND a consolidated SANITY_ENV object for convenience.
//
// Design pillars applied:
// - Efficiency: single import site for env values.
// - Robustness: throws at startup if required vars are missing.
// - Simplicity: tiny helper `assertValue` avoids repetitive checks.
// - Security: readToken is *not* public, only read from a server-side var.
// - Ease of management: one file to update if env keys ever change.

// --- Helper: fail fast when a required variable is missing
function assertValue<T>(v: T | undefined, errorMessage: string): T {
  if (v === undefined || v === null || v === "") {
    throw new Error(errorMessage);
  }
  return v;
}

// --- Public values (safe to expose in the browser)
// These are used by the client to know which Sanity project/dataset to query.
export const projectId = assertValue(
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  "Missing environment variable: NEXT_PUBLIC_SANITY_PROJECT_ID"
);

export const dataset = assertValue(
  process.env.NEXT_PUBLIC_SANITY_DATASET,
  "Missing environment variable: NEXT_PUBLIC_SANITY_DATASET"
);

// API version for GROQ queries (pin to a date for stability)
export const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-03-01";

// --- Server-only value (optional)
// If provided, enables preview/drafts via a token-bearing client.
// DO NOT prefix this with NEXT_PUBLIC_. Keep it server-only.
export const readToken = process.env.SANITY_READ_TOKEN || undefined;

// --- Consolidated object (what the client module expects)
export const SANITY_ENV = {
  projectId,
  dataset,
  apiVersion,
  readToken,
};

// (Optional) default export if you prefer `import env from ".../env"`
export default SANITY_ENV;

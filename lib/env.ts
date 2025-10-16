// lib/env.ts
//
// Purpose:
// - Single, centralized place to read and validate environment variables.
// - Prevents scatter of process.env throughout the app.
// - Enforces safe defaults for published-only reading.
// - Never throw in production for missing optional keys; we fail “softly” where possible.
//
// Pillars:
// - Security: keep token server-only; never leak to client.
// - Robustness: sane defaults + clear comments.
// - Simplicity: tiny helper used by client factories.

export type SanityEnv = {
  projectId: string;
  dataset: string;
  apiVersion: string;
  // Optional read token — only used on the server for drafts or private reads.
  // If absent, client fetches published content only.
  readToken?: string;
};

function readEnv(): SanityEnv {
  const projectId =
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim() || "";
  const dataset =
    process.env.NEXT_PUBLIC_SANITY_DATASET?.trim() || "";
  const apiVersion =
    process.env.SANITY_API_VERSION?.trim() || "2024-03-01";
  const readToken = process.env.SANITY_READ_TOKEN?.trim() || undefined;

  // Minimal validation: fail loudly in dev if critical public keys are missing.
  if (!projectId || !dataset) {
    if (process.env.NODE_ENV !== "production") {
      // Console only — we don't throw to avoid breaking dev for non-content pages.
      console.warn(
        "[env] Missing NEXT_PUBLIC_SANITY_PROJECT_ID or NEXT_PUBLIC_SANITY_DATASET. " +
          "Sanity queries will fail until these are set."
      );
    }
  }

  return { projectId, dataset, apiVersion, readToken };
}

export const SANITY_ENV = readEnv();

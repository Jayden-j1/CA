// lib/sanity/client.ts
//
// Purpose
// -------
// Provide both published and preview Sanity clients plus a unified
// `fetchSanity()` helper for all GROQ queries.
//
// Design pillars:
// - Efficiency: CDN for published reads.
// - Robustness: graceful preview handling (only if token present).
// - Simplicity: single fetch entrypoint for GROQ queries.
// - Security: token only used server-side.
// - Ease of management: centralized config & image URL builder.

import { createClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";
import type { SanityDocumentStub } from "@sanity/client";
import { SANITY_ENV } from "@/lib/sanity/env";

type FetchOptions = {
  // Whether to include draft content if a token is present
  perspective?: "published" | "previewDrafts";
  // Optional: Next.js revalidate tags (future use; no-op here)
  nextTags?: string[];
};

// Extract key configuration values
const { projectId, dataset, apiVersion, readToken } = SANITY_ENV;

// -----------------------------
// Public (CDN-backed) client
// -----------------------------
export const publishedClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true, // cached & fast for published reads
  stega: false,
});

// -----------------------------
// Preview client (server-only, no CDN)
// -----------------------------
// Only created if a server token is provided.
// Never import this into client components.
export const previewClient = readToken
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: false, // avoid CDN for token-based reads
      token: readToken,
      stega: false,
    })
  : null;

// -----------------------------
// Image URL builder
// -----------------------------
const imageBuilder = imageUrlBuilder(publishedClient);
export const urlFor = (source: SanityDocumentStub | any) =>
  imageBuilder.image(source);

// -----------------------------
// Unified Fetch Helper
// -----------------------------
// - Auto-selects correct client (published vs preview).
// - Returns typed data via generics (<T>).
// - Keeps all GROQ fetching consistent across the app.
export async function fetchSanity<T>(
  query: string,
  params: Record<string, unknown> = {},
  opts: FetchOptions = {}
): Promise<T> {
  const wantsPreview = opts.perspective === "previewDrafts";
  const canPreview = Boolean(previewClient);

  const client = wantsPreview && canPreview ? previewClient! : publishedClient;

  try {
    const result = await client.fetch<T>(query, params, {
      perspective: wantsPreview && canPreview ? "previewDrafts" : "published",
    });
    return result;
  } catch (err) {
    console.error("[Sanity] fetchSanity error:", err);
    throw err;
  }
}

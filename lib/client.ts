// lib/sanity/client.ts
//
// Purpose:
// - Provide Sanity clients for published reads + draft preview reads.
// - Offer a tiny `fetchSanity<T>(query, params, opts)` helper with sensible defaults.
// - Keep all Sanity config in one place.
//
// Notes:
// - `publishedClient` → public, cached, CDN-backed (fast, no token).
// - `previewClient`   → server-only, uses token for drafts (no CDN).
// - Never import `previewClient` into client components.
//
// Pillars:
// - Efficiency: CDN for published reads; no-cdn for token/drafts.
// - Security: token never used in browser; clients are created on import.
// - Simplicity: one tiny fetch helper; errors bubble to callers cleanly.

import { createClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";
import type { SanityDocumentStub } from "@sanity/client";
import { SANITY_ENV } from "@/lib/env";

type FetchOptions = {
  // Sanity "perspective":
  // - "published" (default): only published docs
  // - "previewDrafts": show drafts when token is present
  perspective?: "published" | "previewDrafts";
  // Optional revalidate tags (when used in server components or route handlers)
  // You can wire this in Phase 3 if needed; left here for convenience.
  nextTags?: string[];
};

const { projectId, dataset, apiVersion, readToken } = SANITY_ENV;

// ---------- Published-only client (uses CDN) ----------
export const publishedClient = createClient({
  projectId,
  dataset,
  apiVersion,
  // useCdn speeds up reads when no token is required
  useCdn: true,
  // stega: false → avoid embedding query metadata in responses
  stega: false,
});

// ---------- Preview/draft-aware client (no CDN, server only) ----------
export const previewClient =
  readToken
    ? createClient({
        projectId,
        dataset,
        apiVersion,
        useCdn: false, // disable CDN for token-based/draft reads
        token: readToken,
        stega: false,
        // Optional: withCredentials for cookie-based preview flows (not required here)
      })
    : null;

// ---------- Image URL builder (handy later for lesson images) ----------
const imageBuilder = imageUrlBuilder(publishedClient);
export const urlFor = (source: SanityDocumentStub | any) =>
  imageBuilder.image(source);

// ---------- Unified fetch helper ---------------------------------------------
// - Uses publishedClient by default.
// - If opts.perspective === "previewDrafts" and token exists → switch to previewClient.
// - Returns typed data <T> (callers provide a concrete type).
// -----------------------------------------------------------------------------
export async function fetchSanity<T>(
  query: string,
  params: Record<string, unknown> = {},
  opts: FetchOptions = {}
): Promise<T> {
  const wantsPreview = opts.perspective === "previewDrafts";
  const canPreview = Boolean(previewClient);

  const client = wantsPreview && canPreview ? previewClient! : publishedClient;

  // NOTE: For Next.js Server Components/Route Handlers you can pass { next: { tags: [] } }
  // alongside the fetch to integrate ISR/revalidation. We keep it simple here in Phase 1.
  return client.fetch<T>(query, params, {
    // Perspective hints Sanity whether to resolve draft overlays
    perspective: wantsPreview && canPreview ? "previewDrafts" : "published",
  });
}

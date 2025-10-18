// lib/sanity/client.ts
//
// ============================================================
// Sanity client (read-optimized for Next.js caching + tags)
// ------------------------------------------------------------
// Why this file?
//  - Next.js caching (ISR / full-cache) + on-demand revalidation works
//    with the built-in `fetch` API. The Sanity JS client uses its
//    own HTTP stack, which doesn't accept Next's `next:{tags}`.
//  - So for READS, we call Sanity's HTTP Query endpoint using `fetch`
//    and forward any Next.js cache options from callers.
//  - For images, we expose `urlFor()`.
//  - If you ever need mutations, we also export a `sanityClient`
//    (the official JS SDK).
//
// Pillars
//  - Efficiency: only what you need; small helper
//  - Robustness: strict env reading + helpful errors in dev
//  - Simplicity: one function to fetch with cache tags
//  - Security: reads use the public CDN endpoint (no tokens)
//
// Usage
//  const data = await fetchSanity<MyType>(GROQ, { slug }, {
//    // Next.js cache options (optional):
//    next: { tags: ['course:my-slug', 'courses:list'] },
//    revalidate: 60, // or 'force-cache' / 'no-store'
//    // Sanity read options (optional):
//    perspective: 'published', // or 'previewDrafts'
//  })
//
// ============================================================

import { createClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";

// -------------------------
// Env resolution (strict)
// -------------------------
const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  process.env.SANITY_STUDIO_PROJECT_ID ||
  "";

const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_STUDIO_DATASET ||
  "production";

// Fail early in dev to avoid head-scratching later
if (!projectId) {
  // eslint-disable-next-line no-console
  console.warn(
    "[sanity/client] Missing projectId. Set NEXT_PUBLIC_SANITY_PROJECT_ID in your env."
  );
}

// Sanity API version (pin for stability)
const apiVersion = "2023-10-10";

// Base HTTP Query API endpoint (uses CDN by default)
const BASE_QUERY_URL = `https://${projectId}.apicdn.sanity.io/v${apiVersion}/data/query/${dataset}`;

// -------------------------
// Optional: official JS client (for mutations or non-tagged reads)
// -------------------------
export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true, // cached, fast reads
});

// Image URL builder
const builder = imageUrlBuilder({
  projectId,
  dataset,
});
export const urlFor = (source: any) => builder.image(source);

// -------------------------
// Types for helper options
// -------------------------
type FetchInit = {
  /** Next.js cache options */
  cache?: RequestCache; // 'default' | 'force-cache' | 'no-store' ...
  next?: { tags?: string[] };
  /** ISR seconds (same as `revalidate` option on fetch) */
  revalidate?: number | false;
  /** Sanity "perspective": published | previewDrafts */
  perspective?: "published" | "previewDrafts";
  /** Optional signal/headers if you need them */
  signal?: AbortSignal;
  headers?: HeadersInit;
};

// -------------------------
// Utility: encode GROQ params for URL
// -------------------------
function encodeParams(params: Record<string, unknown> | undefined) {
  const usp = new URLSearchParams();
  if (!params) return usp;
  for (const [key, value] of Object.entries(params)) {
    // Sanity expects JSON-encoded parameters
    usp.set(`$${key}`, JSON.stringify(value));
  }
  return usp;
}

// -------------------------
// Helper: fetchSanity<T>
// -------------------------
export async function fetchSanity<T>(
  query: string,
  params?: Record<string, unknown>,
  init?: FetchInit
): Promise<T> {
  if (!projectId) {
    throw new Error(
      "Sanity projectId is missing. Ensure NEXT_PUBLIC_SANITY_PROJECT_ID is set."
    );
  }

  const usp = encodeParams(params);
  usp.set("query", query);

  // Sanity perspective (default: 'published')
  const perspective = init?.perspective ?? "published";
  usp.set("perspective", perspective);

  // Compose final URL
  const url = `${BASE_QUERY_URL}?${usp.toString()}`;

  // Build fetch init
  // NOTE: We pass through Next.js options: next, cache, revalidate
  const fetchInit: RequestInit & {
    next?: { tags?: string[] };
    revalidate?: number | false;
  } = {
    method: "GET",
    headers: {
      ...(init?.headers || {}),
      // No auth header: we’re using the public read CDN.
    },
    cache: init?.cache,
    next: init?.next,
    // @ts-expect-error: Next extends RequestInit with `revalidate`
    revalidate: init?.revalidate,
    signal: init?.signal,
  };

  const res = await fetch(url, fetchInit);

  // Sanity returns 200 with {result} or an error status with {error}
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `[fetchSanity] HTTP ${res.status} ${res.statusText}\n${text}`
    );
  }

  const json = (await res.json()) as { result: T; ms?: number };
  return json.result;
}

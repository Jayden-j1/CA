// lib/sanity/client.ts
//
// ============================================================
// Sanity client (read-optimized for Next.js caching + ODR tags)
// ------------------------------------------------------------
// Why this file?
// - Use Next.js native fetch() so we can leverage:
//     • next: { tags: [...] } → granular On-Demand Revalidation
//     • revalidate: seconds   → ISR fallback
// - Official @sanity/client is great for mutations/uploads, but its fetch
//   doesn’t surface Next’s cache controls. This helper bridges that gap,
//   hitting the Sanity CDN’s Data API directly with your GROQ queries.
// ------------------------------------------------------------
//
// Pillars
// - Efficiency : minimal overhead via CDN; no token for public reads
// - Robustness : strict env guards, defensive defaults
// - Simplicity : one helper to handle query + params + caching
// - Security   : read-only; no secret token required for published queries
// ============================================================

import { createClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";

// ------------------------------
// ⚙️ Environment resolution
// ------------------------------
// We support both public runtime (NEXT_PUBLIC_*) and Studio env names so the same
// code works in local dev, prod, and during Vercel builds.
const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  process.env.SANITY_STUDIO_PROJECT_ID ||
  "";

const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_STUDIO_DATASET ||
  "production";

// Pin the API version (Sanity recommends pinning to a date).
const apiVersion = "2023-10-10";

// Sanity CDN query endpoint (read-only, tokenless)
const BASE_QUERY_URL = `https://${projectId}.apicdn.sanity.io/v${apiVersion}/data/query/${dataset}`;

// Warn (don’t throw) so local dev doesn’t crash before envs are wired.
if (!projectId) {
  console.warn(
    "[sanity/client] Missing projectId. Set NEXT_PUBLIC_SANITY_PROJECT_ID (or SANITY_STUDIO_PROJECT_ID)."
  );
}

// ------------------------------------------------------------
// Optional: Full Sanity JS client (for images, metadata, asset URLs).
// We keep this around for convenience (e.g., urlFor()).
// ------------------------------------------------------------
export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true, // prefer edge cache for published content
});

// Image URL builder (handy for <Image/> components)
const builder = imageUrlBuilder({ projectId, dataset });
export const urlFor = (source: any) => builder.image(source);

// ------------------------------------------------------------
// Helper types
// ------------------------------------------------------------
export interface FetchInit {
  /**
   * Next.js native revalidation (ISR)
   * - number = seconds to keep cached
   * - false  = no ISR (respect 'cache' option if provided)
   */
  revalidate?: number | false;

  /**
   * Next.js cache mode (e.g., "force-cache" | "no-store")
   * Usually leave undefined and rely on tags + revalidate.
   */
  cache?: RequestCache;

  /**
   * Next.js cache tags for ODR granularity, e.g., ["COURSE_DETAIL", "COURSE_DETAIL:slug"]
   */
  tags?: string[];

  /**
   * Sanity read perspective:
   * - "published" (default) for public content
   * - "previewDrafts" if you’re running draftMode (requires token & CORS config; not used here)
   */
  perspective?: "published" | "previewDrafts";

  /** Optional AbortSignal / headers passthrough */
  signal?: AbortSignal;
  headers?: HeadersInit;
}

// ------------------------------------------------------------
// Internal: safely encode GROQ params to URLSearchParams
// ------------------------------------------------------------
// We JSON.stringify all parameter values and prefix with `$` per Sanity spec.
// - Handles numbers/strings/arrays/objects.
// - Avoids collisions with query= itself.
function encodeParams(params?: Record<string, unknown>) {
  const usp = new URLSearchParams();
  if (!params) return usp;
  for (const [key, value] of Object.entries(params)) {
    usp.set(`$${key}`, JSON.stringify(value));
  }
  return usp;
}

// ------------------------------------------------------------
// 🧩 fetchSanity<T>
// ------------------------------------------------------------
// Unified Sanity fetch helper compatible with Next.js caching & ODR.
//
// Usage:
//   const course = await fetchSanity(COURSE_DETAIL_BY_SLUG, { slug }, { tags: ["COURSE_DETAIL", ...], revalidate: 3600 });
//
// Notes:
// - Throws with server-side details if Sanity returns non-2xx (helps diagnose GROQ issues).
// - Uses the CDN endpoint; only published content unless you explicitly pass previewDrafts.
// ------------------------------------------------------------
export async function fetchSanity<T>(
  query: string,
  params?: Record<string, unknown>,
  init?: FetchInit
): Promise<T> {
  if (!projectId) {
    throw new Error(
      "[fetchSanity] Missing NEXT_PUBLIC_SANITY_PROJECT_ID (or SANITY_STUDIO_PROJECT_ID)."
    );
  }

  // Compose URLSearchParams
  const usp = encodeParams(params);
  usp.set("query", query);
  // Perspective is optional; default to published (tokenless).
  if (init?.perspective) usp.set("perspective", init.perspective);

  const url = `${BASE_QUERY_URL}?${usp.toString()}`;

  // Map Next.js cache metadata into fetch options
  const fetchInit: RequestInit & {
    next?: { tags?: string[] };
    revalidate?: number | false;
  } = {
    method: "GET",
    // Headers are rarely needed for public reads; we still allow override.
    headers: init?.headers ?? { Accept: "application/json" },
    // If you need to hard-bust cache per request, set cache: "no-store".
    cache: init?.cache,
    // Tag-aware caching for ODR:
    next: init?.tags ? { tags: init.tags } : undefined,
    // ISR fallback time:
    revalidate: init?.revalidate,
    // AbortSignal passthrough:
    signal: init?.signal,
  };

  const res = await fetch(url, fetchInit);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Surface the raw body from Sanity; it often includes a detailed queryParseError with line/col.
    throw new Error(`[fetchSanity] ${res.status} ${res.statusText}\n${text}`);
  }

  // Sanity Data API returns { result: T }
  const json = (await res.json()) as { result: T };
  return json.result;
}

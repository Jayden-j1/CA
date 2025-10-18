// lib/sanity/client.ts
//
// ============================================================
// Sanity client (read-optimized for Next.js caching + ODR tags)
// ------------------------------------------------------------
// Why this file?
//  - To fetch Sanity data using Next.js native `fetch` API so we can use:
//      • next: { tags: [...] } → for granular cache invalidation
//      • revalidate: seconds   → for ISR fallback
//  - Official @sanity/client doesn't support Next's cache options.
//  - This helper bridges that gap while remaining lightweight.
// ------------------------------------------------------------
//
// Pillars
//  - Efficiency: minimal overhead; all fetches via CDN endpoint.
//  - Robustness: strict envs; defensive defaults.
//  - Simplicity: one function to handle cache + tags + perspective.
//  - Security: public read-only queries via CDN (no tokens).
// ============================================================

import { createClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";

// ------------------------------
// ⚙️ Environment resolution
// ------------------------------
const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  process.env.SANITY_STUDIO_PROJECT_ID ||
  "";

const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_STUDIO_DATASET ||
  "production";

const apiVersion = "2023-10-10"; // pin for stability
const BASE_QUERY_URL = `https://${projectId}.apicdn.sanity.io/v${apiVersion}/data/query/${dataset}`;

if (!projectId) {
  console.warn(
    "[sanity/client] Missing projectId. Did you forget NEXT_PUBLIC_SANITY_PROJECT_ID?"
  );
}

// ------------------------------------------------------------
// Optional: full JS client (for mutations, uploads, etc.)
// ------------------------------------------------------------
export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
});

// Image URL builder
const builder = imageUrlBuilder({ projectId, dataset });
export const urlFor = (source: any) => builder.image(source);

// ------------------------------------------------------------
// Helper types
// ------------------------------------------------------------
export interface FetchInit {
  /**
   * Next.js native revalidation time (ISR)
   * e.g., 60 for 1 minute, false for no revalidate.
   */
  revalidate?: number | false;

  /**
   * Optional Next.js cache control
   * e.g., "force-cache" | "no-store"
   */
  cache?: RequestCache;

  /**
   * Add cache tags for granular ODR revalidation.
   * These will be mapped internally to next: { tags }.
   */
  tags?: string[];

  /**
   * Sanity read perspective
   * - "published" (default)
   * - "previewDrafts" (if using draftMode)
   */
  perspective?: "published" | "previewDrafts";

  /** Optional AbortSignal or headers (rarely needed). */
  signal?: AbortSignal;
  headers?: HeadersInit;
}

// ------------------------------------------------------------
// Internal: safely encode params to URLSearchParams
// ------------------------------------------------------------
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
// ------------------------------------------------------------
export async function fetchSanity<T>(
  query: string,
  params?: Record<string, unknown>,
  init?: FetchInit
): Promise<T> {
  if (!projectId) {
    throw new Error(
      "Missing NEXT_PUBLIC_SANITY_PROJECT_ID. Please set it in your environment."
    );
  }

  const usp = encodeParams(params);
  usp.set("query", query);
  usp.set("perspective", init?.perspective ?? "published");

  const url = `${BASE_QUERY_URL}?${usp.toString()}`;

  const fetchInit: RequestInit & {
    next?: { tags?: string[] };
    revalidate?: number | false;
  } = {
    method: "GET",
    headers: init?.headers ?? {},
    cache: init?.cache,
    // 👇 Map your tags directly into Next’s fetch() options
    next: init?.tags ? { tags: init.tags } : undefined,
    
    revalidate: init?.revalidate,
    signal: init?.signal,
  };

  const res = await fetch(url, fetchInit);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[fetchSanity] ${res.status} ${res.statusText}\n${text}`);
  }

  const json = (await res.json()) as { result: T };
  return json.result;
}

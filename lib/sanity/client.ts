// lib/sanity/client.ts
//
// Purpose
// -------
// One helper `fetchSanity<T>()` that calls the Sanity CDN Data API using
// Next.js' native `fetch`, so you can attach ISR + ODR tags. We now
// import env from a single source of truth (lib/sanity/env.ts) to avoid
// version/ID drift.
//
// What changed (surgical):
// - Removed ad-hoc env discovery here.
// - Reused { projectId, dataset, apiVersion } from lib/sanity/env.ts.
// - Everything else stays the same.
//
// Pillars: efficiency, robustness, simplicity, security.

import { createClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url/lib/types/types";
import { projectId, dataset, apiVersion } from "@/lib/sanity/env";

// Sanity CDN query endpoint (read-only, tokenless)
const BASE_QUERY_URL = `https://${projectId}.apicdn.sanity.io/v${apiVersion}/data/query/${dataset}`;

// Optional: full JS client (handy for metadata helpers)
export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true, // published reads via edge cache
});

// Image URL builder (kept for convenience)
const builder = imageUrlBuilder({ projectId, dataset });
export const urlFor = (source: SanityImageSource) => builder.image(source);

// ---------------- Types ----------------
export interface FetchInit {
  revalidate?: number | false;     // ISR seconds or false
  cache?: RequestCache;            // e.g., "no-store"
  tags?: string[];                 // Next ODR tags
  perspective?: "published" | "previewDrafts";
  signal?: AbortSignal;
  headers?: HeadersInit;
}

// Safely encode GROQ params for the Data API
function encodeParams(params?: Record<string, unknown>) {
  const usp = new URLSearchParams();
  if (!params) return usp;
  for (const [key, value] of Object.entries(params)) {
    usp.set(`$${key}`, JSON.stringify(value));
  }
  return usp;
}

// ---------------- fetchSanity<T> ----------------
export async function fetchSanity<T>(
  query: string,
  params?: Record<string, unknown>,
  init?: FetchInit
): Promise<T> {
  // Compose URL
  const usp = encodeParams(params);
  usp.set("query", query);
  if (init?.perspective) usp.set("perspective", init.perspective);

  const url = `${BASE_QUERY_URL}?${usp.toString()}`;

  // Map Next cache metadata
  const fetchInit: RequestInit & {
    next?: { tags?: string[] };
    revalidate?: number | false;
  } = {
    method: "GET",
    headers: init?.headers ?? { Accept: "application/json" },
    cache: init?.cache,
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










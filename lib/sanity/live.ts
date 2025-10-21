// lib/sanity/live.ts
//
// Purpose
// -------
// Provide a stable, typed interface that mirrors the common
// `next-sanity/live` exports (`sanityFetch`, `SanityLive`) *without*
// depending on that package. This keeps production builds lean and
// avoids version/peer conflicts, while remaining a drop-in for
// any existing code that imports from "@/lib/sanity/live".
//
// What changed?
// -------------
// - Removed: `import { defineLive } from "next-sanity/live"` (caused build error).
// - Replaced with: a minimal pass-through `sanityFetch` that calls your
//   existing `fetchSanity` helper, and a no-op <SanityLive/> component.
// - No runtime behavior changes for published reads.
// - If you later want "live preview" overlays, you can re-introduce the
//   official package and swap this file back with minimal effort.
//
// Pillars
// -------
// ✅ Efficiency  – No extra client bundles or preview libs in prod
// ✅ Robustness  – No missing module risk; uses your proven fetchSanity
// ✅ Simplicity  – Thin wrapper; tiny surface area
// ✅ Ease of mgmt – Centralized place to upgrade to true live later
// ✅ Security    – Reads continue via CDN; no new tokens required

import type { FetchInit } from "@/lib/sanity/client";
import { fetchSanity } from "@/lib/sanity/client";

/**
 * sanityFetch<T>
 * --------------
 * A typed pass-through to your `fetchSanity` helper. Any code that used
 * the `sanityFetch` from `next-sanity/live` can keep importing from
 * "@/lib/sanity/live" and will behave the same for published content reads.
 */
export async function sanityFetch<T>(
  query: string,
  params?: Record<string, unknown>,
  init?: FetchInit
): Promise<T> {
  return fetchSanity<T>(query, params, init);
}

/**
 * SanityLive
 * ----------
 * A no-op component placeholder to keep render sites compiling if
 * `<SanityLive />` is included. In production, it renders nothing.
 * Later, if you want full draft overlays/live preview, replace this
 * with the real component from `next-sanity/live`.
 */
export function SanityLive(): null {
  return null;
}

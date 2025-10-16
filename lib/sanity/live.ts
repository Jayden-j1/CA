// lib/sanity/live.ts
//
// Purpose
// -------
// 1) Provide "sanityFetch" (a live, auto-updating fetch helper) and
//    the <SanityLive/> component for live preview / draft overlays.
// 2) Wire these to your existing published Sanity client.
//    (We import `publishedClient` — there is no named `client` export.)
//
// Notes
// -----
// • If you ever want live content to include drafts (preview mode),
//   you can switch to the preview client when a token is present.
// • This file does not run on the client; it just exports helpers.
//
// Pillars
// -------
// • Efficiency: uses your already-configured client instance.
// • Robustness: no new env vars; works whether token exists or not.
// • Simplicity: a single import change (no behavior changes).
// • Ease of mgmt: consistent single source of truth for clients.

import { defineLive } from "next-sanity/live";
import { publishedClient } from "@/lib/sanity/client";

// Alias the published client to the `client` key expected by defineLive.
// If in the future you want live preview (including drafts), you could
// detect a preview session and swap in `previewClient` instead.
export const { sanityFetch, SanityLive } = defineLive({
  client: publishedClient,
});

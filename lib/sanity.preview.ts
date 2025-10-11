// lib/sanity.preview.ts
//
// Purpose:
// - Enables fetching of draft (unpublished) Sanity documents
//   for real-time preview mode inside Next.js.
// - Requires a read token (stored in .env).
// - This runs server-side only (secure).

import { createClient } from "@sanity/client";

export const sanityPreviewClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2025-01-01",
  useCdn: false, // ✅ Always fetch fresh data
  token: process.env.SANITY_API_TOKEN!, // read token for preview access
});

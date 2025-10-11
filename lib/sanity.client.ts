// lib/sanity.client.ts
//
// Purpose:
// - Establish the standard read-only client for fetching published content from Sanity.
// - Uses CDN for performance and caching.
// - Safe for production builds.

import { createClient } from "@sanity/client";

export const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2025-01-01",
  useCdn: true, // ✅ Enables cached, fast fetches for public content
});

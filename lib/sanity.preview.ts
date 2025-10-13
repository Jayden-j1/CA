// Draft-aware client for preview mode.
import { createClient } from "@sanity/client";

export const sanityPreviewClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2025-01-01",
  useCdn: false,
  token: process.env.SANITY_API_TOKEN!,
});

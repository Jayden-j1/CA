// cms/sanity.config.ts
//
// ============================================================
// ✅ Purpose:
// Configure Sanity Studio v3+ for Next.js (App Router compatible).
//
// 🧱 Pillars:
// - Efficiency: use modern tool API only (no legacy desk-tool).
// - Robustness: strict env checks for projectId.
// - Simplicity: single clean config file.
// - Ease of management: plugin array is declarative and minimal.
// - Security: never hard-code IDs; use envs.
// ============================================================

import { defineConfig } from "sanity";
// Studio v3+: use the new structure tool (desk is deprecated).
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemas";

const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  process.env.SANITY_STUDIO_PROJECT_ID;

const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_STUDIO_DATASET ||
  "production";

if (!projectId) {
  // Fail fast so Studio never boots with a broken config.
  throw new Error(
    "[Sanity Config] Missing NEXT_PUBLIC_SANITY_PROJECT_ID (or SANITY_STUDIO_PROJECT_ID)."
  );
}

export default defineConfig({
  name: "default",
  title: "Cultural Awareness CMS",

  projectId,
  dataset,
  basePath: "/cms",

  // ✅ Modern tool API — no legacy @sanity/desk-tool
  plugins: [
    structureTool(), // main “desk” interface (content lists, editors)
    visionTool({ defaultApiVersion: "2023-10-10" }), // in-Studio GROQ explorer
  ],

  schema: {
    types: schemaTypes,
  },
});

// cms/sanity.config.ts
//
// Purpose
// -------
// Configure Sanity Studio (v3+) and pin the desk sidebar to show only:
// Course, Module, Lesson, Cultural Resource.
//
// What changed (surgical, TS-only):
// - Added an explicit type annotation for the `S` parameter in the
//   structure callback to resolve "Parameter 'S' implicitly has an 'any' type."
//
// Non-goals:
// - No changes to app logic, APIs, payments, progress, or data.
// - No changes to schema content beyond what's already registered.
//
// Pillars: efficiency, robustness, simplicity, ease of management, security.

import { defineConfig } from "sanity";
// Studio v3+: structure API. We import the builder type to type `S`.
import { structureTool } from "sanity/structure";
import type { StructureBuilder } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemas";

// ---- Env resolution (unchanged) ---------------------------------------------

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
    structureTool({
      // Type the builder so `S` is not `any`, fixing the TS error.
      // This function only affects the Studio sidebar; it does not touch data or app logic.
      structure: (S: StructureBuilder) =>
        S.list()
          .title("Content")
          .items([
            S.documentTypeListItem("course"),
            S.documentTypeListItem("module"),
            S.documentTypeListItem("lesson"),
            S.documentTypeListItem("resource"),
            // Intentionally omit the legacy alias ("courseModule") from the desk,
            // while still keeping it registered in schema for existing references.
          ]),
    }),
    visionTool({ defaultApiVersion: "2023-10-10" }),
  ],

  // Register document & object schemas (includes the hidden legacy alias).
  schema: {
    types: schemaTypes,
  },
});











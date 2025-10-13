// sanity.config.ts
//
// Purpose
// -------
// Central Sanity configuration for the embedded Studio at /cms.
//
// This file is imported by app/cms/[[...tool]]/page.tsx using a relative path.
// Vercel requires absolute module resolution, so make sure this file is at the
// project root (same level as package.json).
//
// Pillars
// -------
// - Simplicity: all schema imports declared here.
// - Robustness: validated config shape for Studio runtime.
// - Maintainability: future schema additions only modify this file.

import { defineConfig } from "sanity";
import { deskTool } from "sanity/desk";
import { visionTool } from "@sanity/vision";

// Import your schemas (adjust path if you renamed your folder)
import course from "./cms/schemas/course";
import module from "./cms/schemas/module";
import lesson from "./cms/schemas/lesson";

export default defineConfig({
  name: "default",
  title: "Cultural Awareness CMS",

  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",

  basePath: "/cms",

  plugins: [deskTool(), visionTool()],

  schema: {
    types: [course, module, lesson],
  },
});

// cms/sanity.config.ts
//
// Purpose
// -------
// Studio configuration for /pages/cms route.
// Registers all document + object types.
//
// Important
// ---------
// We import and include the 3 object types (calloutType, quizType, sliderType)
// alongside the document types. This is key to avoid "unknown type" and
// array typing issues.

import { defineConfig } from "sanity";
import { deskTool } from "sanity/desk";
import { visionTool } from "@sanity/vision";
import { muxInput } from "sanity-plugin-mux-input";

import course from "./schemas/course";
import module from "./schemas/module";
import lesson, { calloutType, quizType, sliderType } from "./schemas/lesson";

export default defineConfig({
  name: "default",
  title: "Cultural Awareness CMS",
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  basePath: "/cms",
  plugins: [deskTool(), visionTool(), muxInput()],
  schema: {
    // Include *all* document and object types
    types: [course, module, lesson, calloutType, quizType, sliderType],
  },
});

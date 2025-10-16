// sanity.config.ts
//
// Purpose
// -------
// Central configuration for your Sanity Studio at /cms.
//
// Problem Fixed
// --------------
// TypeScript complained: Type 'string | undefined' is not assignable to type 'string'.
// This happens because environment variables are optional by type.
// We fix it by adding explicit fallback logic and narrowing types
// using the nullish coalescing operator (??) and a runtime guard.
//
// Pillars
// --------
// ✅ Simplicity – no external type hacks.
// ✅ Robustness – fails loudly if missing projectId.
// ✅ Ease of management – works for both Next.js & Vite Studio.
// ✅ Security – values always read from .env.

import { defineConfig } from "sanity";
import { deskTool } from "sanity/desk";
import { visionTool } from "@sanity/vision";
import { schema as schemaBundle } from "./lib/sanity/schemaTypes";
import dotenv from "dotenv";

// ✅ Load .env for local dev (Vite / npx sanity dev)
dotenv.config();

// ---------------------------------------------------------------------------
// 1️⃣ Resolve and Narrow Environment Variables
// ---------------------------------------------------------------------------
// Use nullish coalescing (??) to guarantee a final string value
// while keeping TS aware that projectId/dataset are strings.
const projectId = (
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ??
  process.env.SANITY_STUDIO_PROJECT_ID ??
  ""
).trim();

const dataset = (
  process.env.NEXT_PUBLIC_SANITY_DATASET ??
  process.env.SANITY_STUDIO_DATASET ??
  "production"
).trim();

// ---------------------------------------------------------------------------
// 2️⃣ Fail Fast (Optional Safety Guard)
// ---------------------------------------------------------------------------
// If projectId is still empty, throw a descriptive error at startup
if (!projectId) {
  throw new Error(
    "❌ Sanity projectId is missing. Please define NEXT_PUBLIC_SANITY_PROJECT_ID in your .env or .env.local file."
  );
}

// ---------------------------------------------------------------------------
// 3️⃣ Define Sanity Config
// ---------------------------------------------------------------------------
// TypeScript now sees projectId/dataset as guaranteed strings.
export default defineConfig({
  name: "default",
  title: "Cultural Awareness CMS",

  projectId,
  dataset,

  basePath: "/cms",

  plugins: [deskTool(), visionTool()],

  schema: {
    types: schemaBundle.types,
  },
});

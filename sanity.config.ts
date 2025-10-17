// sanity.config.ts
//
// Purpose
// -------
// Central configuration for Sanity Studio at /cms.
//
// Problems solved
// ---------------
// 1) "Type 'string | undefined' is not assignable to type 'string'":
//    -> We narrow env vars with nullish coalescing + runtime guard.
// 2) "process.cwd is not a function" when running `npx sanity dev`:
//    -> We only load dotenv in Node (server) environments.
//       Sanity Studio (Vite) executes part of this in the browser,
//       so we must not call Node APIs there.
//
// Pillars
// -------
// ✅ Simplicity  – small, self-contained file.
// ✅ Robustness  – Node-only dotenv, graceful fallbacks.
// ✅ Security    – values come from .env/.env.local only.
// ✅ Ease of mgmt – consistent across Next build + Studio dev.

import { defineConfig } from "sanity";
import { deskTool } from "sanity/desk";
import { visionTool } from "@sanity/vision";
import { schema as schemaBundle } from "./lib/sanity/schemaTypes";

// ---------------------------------------------------------------------------
// 1) Load .env only in Node (prevents Vite/browser crashes in Studio)
// ---------------------------------------------------------------------------
// - Vite may evaluate this file in a browser-like context (no process.cwd).
// - Guard ensures we only import and run dotenv in Node.
// - This still allows `npx sanity dev` to use your .env locally.
if (typeof process !== "undefined" && typeof process.cwd === "function") {
  try {
    // Dynamic import avoids bundling dotenv into browser chunks.
    const dotenv = await import("dotenv");
    dotenv.config();
  } catch {
    // Non-fatal in the browser; Next/Sanity also inject envs via other means.
  }
}

// ---------------------------------------------------------------------------
// 2) Resolve & narrow env variables to concrete strings
// ---------------------------------------------------------------------------
// We coalesce through both NEXT_PUBLIC_* and SANITY_STUDIO_* to support
// either naming convention. Final fallback: "" (empty string) which
// triggers a fail-fast error below for projectId.
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

// Fail fast if projectId is missing – keeps Studio state obvious.
if (!projectId) {
  throw new Error(
    "❌ Missing Sanity `projectId`. Define NEXT_PUBLIC_SANITY_PROJECT_ID (or SANITY_STUDIO_PROJECT_ID) in your .env/.env.local."
  );
}

// ---------------------------------------------------------------------------
// 3) Export Studio configuration
// ---------------------------------------------------------------------------
// TypeScript now sees projectId/dataset as plain strings (no union w/ undefined).
export default defineConfig({
  name: "default",
  title: "Cultural Awareness CMS",

  projectId,
  dataset,

  // Your Studio is mounted at /cms inside the Next.js app
  basePath: "/cms",

  // Core Studio tools
  plugins: [deskTool(), visionTool()],

  // Pull in your schema bundle (documents + objects)
  schema: {
    types: schemaBundle.types,
  },
});

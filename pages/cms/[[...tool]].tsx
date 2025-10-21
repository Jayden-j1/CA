// pages/cms/[[...tool]].tsx
//
// ============================================================
// ✅ Purpose:
// Mount Sanity Studio at /cms using the official <Studio /> component.
// No need for next-sanity/studio. This keeps the dependency
// surface minimal and aligned with Studio v3.
//
// 🧱 Pillars:
// - Efficiency: no extra wrapper packages.
// - Robustness: official component, stable API.
// - Simplicity: single import, just pass config.
// - Security: you can protect /cms via middleware.
// ============================================================

"use client";

import { Studio } from "sanity";
import config from "../../cms/sanity.config";

export default function StudioPage() {
  // Renders the Studio UI using your config under /cms.
  return <Studio config={config} />;
}

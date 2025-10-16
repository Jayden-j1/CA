// lib/sanity/image.ts
//
// Purpose
// -------
// Provide a small helper to build image URLs for Sanity assets.
// This file is frequently imported by UI components (cards, hero banners, etc.).
//
// Why this change?
// ----------------
// The previous version imported `projectId` and `dataset` from "../env" which
// resolves to `lib/env.ts` (does NOT export Sanity variables).
// Your Sanity variables live in `lib/sanity/env.ts`. We now import from there
// to fix "has no exported member" TypeScript errors.
//
// Design pillars:
// - Simplicity: one tiny function `urlFor(source)`.
// - Robustness: imports from the correct env module.
// - Ease of management: matches the same env source used by `lib/sanity/client.ts`.

import createImageUrlBuilder from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url/lib/types/types";

// ✅ Import from the correct env module (lib/sanity/env.ts)
import { projectId, dataset } from "@/lib/sanity/env";

// Create a builder instance using your project's configuration.
// Docs: https://www.sanity.io/docs/image-url
const builder = createImageUrlBuilder({ projectId, dataset });

/**
 * Build an image URL for any Sanity image source.
 *
 * Example:
 *    <img src={urlFor(image).width(800).height(600).url()} />
 */
export const urlFor = (source: SanityImageSource) => builder.image(source);

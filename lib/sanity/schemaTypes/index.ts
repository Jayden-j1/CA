// lib/sanity/schemaTypes/index.ts
//
// Purpose
// -------
// Aggregate schema types for Sanity Studio (v3).
//
// Why this change?
// ----------------
// In some setups, Sanity's `SchemaTypeDefinition` is surfaced as a *namespace*,
// which makes annotations like `{ types: SchemaTypeDefinition[] }` fail with:
//   "Cannot use namespace 'SchemaTypeDefinition' as a type."
// To keep the build stable and avoid coupling to the exact type shape, we
// export a plain object with a `types` array (no explicit TS type). This is
// fully compatible with `defineConfig({ schema: { types } })` in sanity.config.
//
// Pillars
// -------
// ✅ Efficiency  – zero runtime changes
// ✅ Robustness  – works across Sanity/TS variations
// ✅ Simplicity  – no extra type packages required
// ✅ Ease of mgmt – all schema parts registered in one place
// ✅ Security    – only exports the intended schema definitions

// 🔕 Do NOT import `type { SchemaTypeDefinition }` here to avoid the namespace/type conflict.
// import { type SchemaTypeDefinition } from "sanity";

// Document & object schemas
import { quiz } from "./quiz";
import { lesson } from "./lesson";
import { courseModule } from "./module";
import { course } from "./course";
import { videoEmbed } from "./objects/videoEmbed";
import { callout } from "./objects/callout"; // ✅ ensure this object is registered

// ✅ Export the schema object without annotating the type.
//    Sanity Studio only needs `schema.types` at runtime.
export const schema = {
  types: [
    // Document types
    course,
    courseModule,
    lesson,

    // Object types embedded inside documents
    quiz,
    videoEmbed,
    callout,
  ],
};

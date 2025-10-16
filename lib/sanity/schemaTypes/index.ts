// lib/sanity/schemaTypes/index.ts
//
// Purpose
// -------
// Aggregate schema types for Sanity Studio (v3).
//
// What changed?
// -------------
// - We now include `callout` in the list (you created it).
// - We keep `videoEmbed` in, since your PortableTextRenderer handles it.
// - Exported as `schema.types` so sanity.config.ts can import one bundle.
//
// Pillars
// -------
// - Simplicity: import here once, use everywhere
// - Robustness: all types registered in one array

import { type SchemaTypeDefinition } from "sanity";

// Documents & objects you already have
import { quiz } from "./quiz";
import { lesson } from "./lesson";
import { courseModule } from "./module";
import { course } from "./course";
import { videoEmbed } from "./objects/videoEmbed";

// ✅ Include callout (you provided this, but it wasn’t registered yet)
import { callout } from "./objects/callout";

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    // document types
    course,
    courseModule,
    lesson,

    // object types embedded inside documents
    quiz,
    videoEmbed,
    callout,
  ],
};

// lib/sanity/schemaTypes/index.ts
//
// Purpose
// -------
// Aggregate schema types for Sanity Studio (v3).
// We import the object + document types and export them in `types`.
//
// Notes
// -----
// • The order does not matter.
// • Add more types here later if needed.

import { type SchemaTypeDefinition } from "sanity";

import { quiz } from "./quiz";
import { lesson } from "./lesson";
import { courseModule } from "./module";
import { course } from "./course";

// 👇 New object types
import { videoEmbed } from "./objects/videoEmbed";
import { callout } from "./objects/callout";

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    // Objects first (convention only)
    videoEmbed,
    callout,

    // Documents
    quiz,
    lesson,
    courseModule,
    course,
  ],
};

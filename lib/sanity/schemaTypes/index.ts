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
// • You can add more types here later (e.g., callout blocks).

import { type SchemaTypeDefinition } from "sanity";
import { quiz } from "./quiz";
import { lesson } from "./lesson";
import { courseModule } from "./module";
import { course } from "./course";

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [quiz, lesson, courseModule, course],
};

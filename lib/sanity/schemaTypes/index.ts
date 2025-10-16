// lib/sanity/schemaTypes/index.ts
//
// Purpose
// -------
// Aggregate your schema types for Sanity Studio.
// For now this exports an empty array. In Phase 2 we’ll add
// `course`, `module`, `lesson`, and `quiz` schema definitions
// and include them in the `types` array.

import { type SchemaTypeDefinition } from "sanity";

export const schema: { types: SchemaTypeDefinition[] } = {
  // When ready, import and add:
  // types: [course, module, lesson, quiz]
  types: [],
};

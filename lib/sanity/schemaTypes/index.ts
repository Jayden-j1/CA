// lib/sanity/schemaTypes/index.ts
//
// Purpose
// -------
// Aggregate schema types for Sanity Studio (v3).
// Now includes:
//  • course           – top-level course with ordered modules (refs)
//  • courseModule     – supports lessons *and* nested subModules (refs)
//  • lesson           – rich body (Portable Text) + optional quiz
//  • quiz             – structured quiz object (embedded in lesson)
//  • videoEmbed       – custom PT object for inline video by URL
//
// Notes
// -----
// You can add more object types (callouts, code blocks, etc.) later.

import { type SchemaTypeDefinition } from "sanity";
import { quiz } from "./quiz";
import { lesson } from "./lesson";
import { courseModule } from "./module";
import { course } from "./course";
import { videoEmbed } from "./objects/videoEmbed";

export const schema: { types: SchemaTypeDefinition[] } = {
  // Order does not matter; documents can reference objects defined anywhere
  types: [quiz, videoEmbed, lesson, courseModule, course],
};

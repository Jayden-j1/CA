// lib/sanity/schemaTypes/index.ts
//
// Purpose
// -------
// Aggregate schema types for Sanity Studio (v3).

import { type SchemaTypeDefinition } from "sanity";
import { quiz } from "./quiz";
import { lesson } from "./lesson";
import { courseModule } from "./module";
import { course } from "./course";
import { videoEmbed } from "./objects/videoEmbed"; // ✅ NEW

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [quiz, lesson, courseModule, course, videoEmbed], // ✅ include
};

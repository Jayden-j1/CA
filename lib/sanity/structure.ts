// lib/sanity/structure.ts
//
// Purpose
// -------
// Minimal custom “desk” structure for Sanity Studio. Right now we simply
// list all document types. You can expand this later to group content
// (e.g., “Courses”, “Modules”, “Lessons”).
//
// Keeping the file as-is avoids unneeded behavior changes.

import type { StructureResolver } from "sanity/structure";

// https://www.sanity.io/docs/structure-builder-cheat-sheet
export const structure: StructureResolver = (S) =>
  S.list().title("Content").items(S.documentTypeListItems());

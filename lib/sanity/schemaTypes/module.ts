// lib/sanity/schemaTypes/module.ts
//
// Purpose
// -------
// A course module that contains ordered lessons (references).
//
// Fields
// ------
//  • title       (required)
//  • description (optional)
//  • lessons     (array of references to `lesson`)
//
// Notes
// -----
// • We use references to allow reuse and to keep large content modular.
// • The API will dereference lessons (lesson->) to match your frontend types.

import { defineType, defineField } from "sanity";

export const courseModule = defineType({
  name: "courseModule",
  title: "Module",
  type: "document",
  fields: [
    defineField({
      name: "title",
      type: "string",
      validation: (rule) => rule.required().min(3).max(120),
    }),
    defineField({
      name: "description",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "lessons",
      title: "Lessons (in order)",
      type: "array",
      of: [{ type: "reference", to: [{ type: "lesson" }] }],
      validation: (rule) => rule.min(1).error("Add at least one lesson"),
    }),
  ],
  preview: {
    select: { title: "title", count: "lessons.length" },
    prepare: ({ title, count }) => ({
      title: title || "Untitled Module",
      subtitle: `${count || 0} lesson${(count || 0) === 1 ? "" : "s"}`,
    }),
  },
});

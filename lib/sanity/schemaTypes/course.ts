// lib/sanity/schemaTypes/course.ts
//
// Purpose
// -------
// A course that contains ordered modules (references).
//
// Fields
// ------
//  • title       (required)
//  • slug        (required; unique; used in /api/courses/[slug])
//  • summary     (optional short description)
//  • coverImage  (optional image)
//  • modules     (array of references to `courseModule`)
//
// Notes
// -----
// • We reference modules for flexibility; the API dereferences them.
// • Slug is required so your app can fetch by slug.

import { defineType, defineField } from "sanity";

export const course = defineType({
  name: "course",
  title: "Course",
  type: "document",
  fields: [
    defineField({
      name: "title",
      type: "string",
      validation: (rule) => rule.required().min(3).max(140),
    }),
    defineField({
      name: "slug",
      type: "slug",
      options: {
        source: "title",
        maxLength: 96,
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "summary",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "coverImage",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "modules",
      title: "Modules (in order)",
      type: "array",
      of: [{ type: "reference", to: [{ type: "courseModule" }] }],
      validation: (rule) => rule.min(1).error("Add at least one module"),
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "slug.current" },
  },
});

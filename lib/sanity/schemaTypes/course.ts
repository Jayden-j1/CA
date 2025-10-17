// lib/sanity/schemaTypes/course.ts
//
// Purpose
// -------
// A course document that *references* ordered modules.
// The UI displays modules in the order you set in the Course document.
//
// Fields
// ------
//  • title       (required)
//  • slug        (required; unique; used in /api/courses/[slug])
//  • summary     (optional short description)
//  • coverImage  (optional image)
//  • modules     (array<reference<courseModule>>)
//
// Notes
// -----
// • We reference modules for flexibility; the API/queries dereference them.
// • Slug is required so your app can fetch by /api/courses/[slug] or directly in pages.
//
import { defineType, defineField } from "sanity";

export const course = defineType({
  name: "course",
  title: "Course",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required().min(3).max(140),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "title", // click "Generate" from title
        maxLength: 96,
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "summary",
      title: "Summary",
      type: "text",
      rows: 3,
      description: "Short description shown in lists/headers.",
    }),
    defineField({
      name: "coverImage",
      title: "Cover Image",
      type: "image",
      options: { hotspot: true },
      description: "Optional hero/cover image for the course.",
    }),
    defineField({
      name: "modules",
      title: "Modules (in order)",
      description:
        "Choose modules and drag to reorder. The UI respects this order (also supports each Module's own 'order' field).",
      type: "array",
      of: [{ type: "reference", to: [{ type: "courseModule" }] }],
      validation: (rule) => rule.min(1).error("Add at least one module"),
    }),
  ],
  preview: {
    select: {
      title: "title",
      slug: "slug.current",
      media: "coverImage",
      modulesLen: "modules.length",
    },
    prepare: ({ title, slug, media, modulesLen }) => ({
      title: title || "Untitled Course",
      subtitle: slug ? `/${slug} • ${modulesLen || 0} module(s)` : `${modulesLen || 0} module(s)`,
      media,
    }),
  },
});

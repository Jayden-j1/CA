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
// Why change?
// -----------
// In some setups, Sanity's `Rule` is surfaced as a *namespace* (not a `type`), which
// makes annotations like `(rule: Rule)` fail with:
//   "Cannot use namespace 'Rule' as a type."
// To keep things minimal, robust, and compatible across environments, we annotate
// the validation callback parameter as `any`. This prevents implicit-any while avoiding
// dependency on the exact `Rule` type shape. No runtime behavior changes.

import { defineType, defineField } from "sanity";
// 🔕 Do not import `type { Rule }` here — it may be a namespace in your environment.

export const course = defineType({
  name: "course",
  title: "Course",
  type: "document",

  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      // ✅ Typed (no implicit any), decoupled from Sanity's `Rule` type to avoid the namespace error.
      validation: (rule: any) => rule.required().min(3).max(140),
    }),

    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "title", // click "Generate" from title
        maxLength: 96,
      },
      // ✅ Same approach: `any` keeps the chainable API and avoids type mismatches.
      validation: (rule: any) => rule.required(),
    }),

    defineField({
      name: "summary",
      title: "Summary",
      type: "text",
      rows: 3,
      description: "Short description shown in lists/headers.",
      // Optional example if you want a cap later:
      // validation: (rule: any) => rule.max(240)
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
      // ✅ Enforce at least one module selected.
      validation: (rule: any) => rule.min(1).error("Add at least one module"),
    }),
  ],

  preview: {
    select: {
      title: "title",
      slug: "slug.current",
      media: "coverImage",
      modulesLen: "modules.length",
    },
    prepare: ({
      title,
      slug,
      media,
      modulesLen,
    }: {
      title?: string;
      slug?: string;
      media?: any;
      modulesLen?: number;
    }) => ({
      title: title || "Untitled Course",
      subtitle: slug
        ? `/${slug} • ${modulesLen || 0} module(s)`
        : `${modulesLen || 0} module(s)`,
      media,
    }),
  },
});

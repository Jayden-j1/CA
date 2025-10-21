// lib/sanity/schemaTypes/module.ts
//
// Purpose
// -------
// A course module that may contain ordered lessons AND/OR ordered submodules.
// This allows hierarchies like "Module 1 → 1.1 … 1.6" etc.
//
// Fields
// ------
//  • title       (required)
//  • description (optional)
//  • order       (optional; numeric ordering helper)
//  • lessons     (array of references to `lesson`)
//  • submodules  (array of references to *this* type `courseModule`) ← nested
//
// Why these typing changes?
// -------------------------
// Validation callbacks (`rule`) and `preview.prepare` destructuring can be
// implicitly `any` in strict TS builds. We annotate them as `any` to avoid
// type errors without bringing in additional @types packages.

import { defineType, defineField } from "sanity";

export const courseModule = defineType({
  name: "courseModule",
  title: "Module",
  type: "document",
  fields: [
    defineField({
      name: "title",
      type: "string",
      validation: (rule: any) => rule.required().min(3).max(120),
    }),
    defineField({
      name: "description",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "order",
      title: "Order (optional)",
      type: "number",
      description:
        "Optional ordering helper. If omitted, parent array order is used.",
      validation: (rule: any) => rule.min(0).max(9999),
    }),
    defineField({
      name: "lessons",
      title: "Lessons (in order)",
      type: "array",
      of: [{ type: "reference", to: [{ type: "lesson" }] }],
    }),
    defineField({
      name: "submodules",
      title: "Submodules (in order)",
      type: "array",
      of: [{ type: "reference", to: [{ type: "courseModule" }] }],
      description:
        "Optional nested submodules. The API flattens these to keep the front-end simple.",
    }),
  ],
  preview: {
    select: { title: "title", count: "lessons.length", order: "order" },
    // ✅ Type as `any` so destructured props aren’t implicit-any
    prepare: ({ title, count, order }: any) => ({
      title: title || "Untitled Module",
      subtitle: `${order != null ? `#${order} · ` : ""}${count || 0} lesson${
        (count || 0) === 1 ? "" : "s"
      }`,
    }),
  },
});

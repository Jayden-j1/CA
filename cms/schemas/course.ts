// cms/schemas/course.ts
//
// ============================================================
// ✅ Purpose
// Defines the “Course” document type within Sanity v3 CMS.
//
// 🧱 Pillars
// - Efficiency   : lean schema, only needed fields.
// - Robustness   : validation rules for required fields.
// - Simplicity   : modular and readable.
// - Ease of mgmt : future fields can be added easily.
// - Security     : explicit types, avoid “any”.  
// ============================================================

import { defineField, defineType } from "sanity";

export default defineType({
  name: "course",
  title: "Course",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Course Title",
      type: "string",
      validation: (Rule: any) => Rule.required().min(3).max(100),
    }),

    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (Rule: any) => Rule.required(),
    }),

    defineField({
      name: "summary",
      title: "Summary",
      type: "text",
      rows: 3,
      description: "Short course description (appears in listings)",
    }),

    defineField({
      name: "coverImage",
      title: "Cover Image",
      type: "image",
      options: { hotspot: true },
    }),

    defineField({
      name: "modules",
      title: "Modules",
      type: "array",
      of: [{ type: "reference", to: [{ type: "module" }] }],
      validation: (Rule: any) => Rule.unique(),
    }),

    defineField({
      name: "publishedAt",
      title: "Published At",
      type: "datetime",
      description: "Used for scheduling course visibility",
    }),
  ],
});

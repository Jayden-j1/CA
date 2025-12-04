// cms/schemas/course.ts
//
// Only change: the `modules` reference now accepts BOTH the modern "module"
// and the legacy "courseModule". This makes all existing items valid in Studio
// without touching your data or frontend.

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

    // ✅ The critical line: allow both modern and legacy module types
    defineField({
      name: "modules",
      title: "Modules",
      type: "array",
      of: [
        {
          type: "reference",
          to: [
            { type: "module" },        // modern
            { type: "courseModule" },  // legacy alias
          ],
        },
      ],
      validation: (Rule: any) => Rule.unique(),
      description:
        "Ordered list of modules. Existing references using the legacy type are supported.",
    }),

    defineField({
      name: "publishedAt",
      title: "Published At",
      type: "datetime",
      description: "Used for scheduling course visibility",
    }),
  ],
});










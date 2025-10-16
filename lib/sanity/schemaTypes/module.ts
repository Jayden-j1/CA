// lib/sanity/schemaTypes/module.ts
//
// Purpose
// -------
// A course module that supports BOTH:
//  • ordered lessons (references to `lesson`)
//  • ordered nested sub-modules (self-references to `courseModule`)
//
// Why allow nested sub-modules?
// -----------------------------
// Lets you model structures like:
//   Module 1
//     ├─ Submodule 1.1
//     │   ├─ Lesson A
//     │   └─ Lesson B
//     └─ Submodule 1.2
//         └─ Lesson C
//
// UI impact
// ---------
// Your frontend can either:
//  • render the hierarchy, OR
//  • flatten it in the API layer (recommended initially to avoid UI churn).

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

    // Optional numeric sort key
    defineField({
      name: "order",
      title: "Order",
      type: "number",
      description:
        "Optional ordering helper (0..9999). If omitted, array order from the parent document is used.",
      validation: (rule) => rule.min(0).max(9999),
    }),

    // Lessons (keeps array order)
    defineField({
      name: "lessons",
      title: "Lessons (in order)",
      type: "array",
      of: [{ type: "reference", to: [{ type: "lesson" }] }],
      validation: (rule) => rule.min(0), // lesson-less 'index' modules are allowed when they only group subModules
    }),

    // NEW: nested sub-modules (self-reference)
    defineField({
      name: "subModules",
      title: "Sub-modules (in order)",
      type: "array",
      of: [{ type: "reference", to: [{ type: "courseModule" }] }],
      validation: (rule) => rule.min(0),
      description:
        "Optional. Use when this module is a 'container' of smaller modules.",
    }),
  ],

  preview: {
    select: {
      title: "title",
      countLessons: "lessons.length",
      countSubs: "subModules.length",
      order: "order",
    },
    prepare: ({ title, countLessons, countSubs, order }) => {
      const parts: string[] = [];
      if (typeof order === "number") parts.push(`#${order}`);
      if (typeof countLessons === "number") parts.push(`${countLessons} lesson${countLessons === 1 ? "" : "s"}`);
      if (typeof countSubs === "number" && countSubs > 0)
        parts.push(`${countSubs} sub-module${countSubs === 1 ? "" : "s"}`);
      return {
        title: title || "Untitled Module",
        subtitle: parts.join(" · "),
      };
    },
  },
});

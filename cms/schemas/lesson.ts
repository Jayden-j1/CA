// cms/schemas/lesson.ts
//
// Purpose
// -------
// Define the Lesson document schema for Sanity v3+, with correct TypeScript
// typing for validation callbacks.
//
// Why this change?
// ----------------
// Your previous build failed with:
//   "Cannot use namespace 'Rule' as a type."
// In some environments the `Rule` exported by "sanity" is compiled as a
// namespace, which TS won’t accept in a type position. Importing `Rule` from
// "@sanity/types" gives us a stable type-only symbol that works across setups.
//
// Pillars
// -------
// ✅ Efficiency  – Minimal schema; only necessary fields
// ✅ Robustness  – Proper TS typings for validation rules
// ✅ Simplicity  – Clear, consistent validation pattern
// ✅ Ease of mgmt – Copy/paste pattern for other schemas
// ✅ Security    – Explicit field definitions

import { defineField, defineType } from "sanity";
// ✅ Use the canonical type source for Sanity schema validation:
import type { Rule as SanityRule } from "@sanity/types";

export default defineType({
  name: "lesson",
  title: "Lesson",
  type: "document",

  fields: [
    // --------------------------------------------------------
    // 🏷️ Title
    // --------------------------------------------------------
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      // ✅ Type the validation callback parameter with @sanity/types' Rule
      validation: (rule: SanityRule) => rule.required().min(3).max(120),
    }),

    // --------------------------------------------------------
    // 🔢 Order (optional)
    // Helps sort lessons within a module.
    // --------------------------------------------------------
    defineField({
      name: "order",
      title: "Order",
      type: "number",
      description: "Optional order index (used to sort lessons inside a module).",
      validation: (rule: SanityRule) => rule.min(0).integer(),
    }),

    // --------------------------------------------------------
    // 🎬 Video URL (optional)
    // --------------------------------------------------------
    defineField({
      name: "videoUrl",
      title: "Video URL",
      type: "url",
      description: "Optional link to a video resource for this lesson.",
      // Keep validation permissive, but ensure valid URL scheme
      validation: (rule: SanityRule) =>
        rule.uri({ allowRelative: false, scheme: ["http", "https"] }),
    }),

    // --------------------------------------------------------
    // 📄 Body (Portable Text)
    // --------------------------------------------------------
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      of: [{ type: "block" }],
      description: "Main lesson content.",
      validation: (rule: SanityRule) => rule.required(),
    }),

    // --------------------------------------------------------
    // 📝 Short Text (the field that previously errored)
    // --------------------------------------------------------
    defineField({
      name: "text",
      title: "Text",
      type: "text",
      rows: 3,
      validation: (rule: SanityRule) => rule.required().min(1),
    }),

    // --------------------------------------------------------
    // 🎚️ Tone (optional tag)
    // --------------------------------------------------------
    defineField({
      name: "tone",
      title: "Tone",
      type: "string",
      options: {
        list: [
          { title: "Neutral", value: "neutral" },
          { title: "Informative", value: "informative" },
          { title: "Reflective", value: "reflective" },
          { title: "Encouraging", value: "encouraging" },
        ],
        layout: "dropdown",
      },
      validation: (rule: SanityRule) => rule.optional(),
    }),

    // --------------------------------------------------------
    // 🧩 Quiz (optional)
    // --------------------------------------------------------
    defineField({
      name: "quiz",
      title: "Quiz",
      type: "object",
      fields: [
        defineField({
          name: "passingScore",
          title: "Passing Score",
          type: "number",
          validation: (rule: SanityRule) => rule.min(0).max(100),
        }),
        defineField({
          name: "questions",
          title: "Questions",
          type: "array",
          of: [
            defineField({
              name: "questionItem",
              title: "Question",
              type: "object",
              fields: [
                defineField({
                  name: "id",
                  title: "ID",
                  type: "string",
                  description: "Optional stable ID for syncing with the app.",
                }),
                defineField({
                  name: "question",
                  title: "Question",
                  type: "string",
                  validation: (rule: SanityRule) => rule.required().min(3),
                }),
                defineField({
                  name: "options",
                  title: "Options",
                  type: "array",
                  of: [{ type: "string" }],
                  validation: (rule: SanityRule) => rule.min(2),
                }),
                defineField({
                  name: "correctIndex",
                  title: "Correct Option Index",
                  type: "number",
                  validation: (rule: SanityRule) => rule.min(0),
                }),
              ],
            }),
          ],
        }),
      ],
      validation: (rule: SanityRule) => rule.optional(),
    }),
  ],
});

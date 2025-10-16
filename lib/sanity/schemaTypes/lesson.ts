// lib/sanity/schemaTypes/lesson.ts
//
// Purpose
// -------
// A single lesson with:
//  • title (required)
//  • videoUrl (optional string or URL)
//  • body (rich text — portable text)
//  • quiz (optional; structured via `quiz` object)
//
// Notes
// -----
// • Lessons are **referred to** by modules (reference array).
// • Preview shows the title for easy navigation.

import { defineType, defineField } from "sanity";

export const lesson = defineType({
  name: "lesson",
  title: "Lesson",
  type: "document",
  fields: [
    defineField({
      name: "title",
      type: "string",
      validation: (rule) => rule.required().min(3).max(120),
    }),
    defineField({
      name: "videoUrl",
      title: "Video URL",
      type: "url",
      description:
        "URL to your hosted video (YouTube, Vimeo, Mux, etc.). Can also be a plain string if needed.",
      // URL type already validates, keep it optional
    }),
    defineField({
      name: "body",
      title: "Lesson Body",
      type: "array",
      of: [{ type: "block" }],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "quiz",
      title: "Quiz (optional)",
      type: "quiz",
    }),
  ],
  preview: {
    select: { title: "title" },
  },
});

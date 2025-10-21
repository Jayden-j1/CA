// lib/sanity/schemaTypes/quiz.ts
//
// Purpose
// -------
// Structured quiz data stored INSIDE a lesson.
// A quiz has multiple questions; each question has:
//  - question (string)
//  - options (array of strings; 2–8 choices)
//  - correctIndex (number; points to an option)
//
// Why these typing changes?
// -------------------------
// We annotate validation `rule` params and preview.prepare params as `any` to
// avoid implicit-any errors in strict TS builds. No runtime behavior change.

import { defineType, defineField } from "sanity";

export const quiz = defineType({
  name: "quiz",
  title: "Quiz",
  type: "object",
  fields: [
    defineField({
      name: "questions",
      title: "Questions",
      type: "array",
      of: [
        {
          type: "object",
          name: "question",
          fields: [
            defineField({
              name: "id",
              title: "Question ID",
              type: "string",
              description:
                "Stable ID for this question (e.g., m1q1). If blank, the API/query will auto-generate one based on the array key.",
            }),
            defineField({
              name: "question",
              title: "Question Text",
              type: "string",
              validation: (rule: any) => rule.required().min(5),
            }),
            defineField({
              name: "options",
              title: "Options",
              type: "array",
              of: [{ type: "string" }],
              validation: (rule: any) => rule.required().min(2).max(8),
            }),
            defineField({
              name: "correctIndex",
              title: "Correct Option Index",
              type: "number",
              description:
                "Zero-based index into the options array (0 for first option).",
              validation: (rule: any) => rule.required().min(0),
            }),
          ],
          preview: {
            select: { title: "question" },
            prepare: ({ title }: any) => ({
              title: title || "Untitled question",
              subtitle: "Quiz question",
            }),
          },
        },
      ],
      validation: (rule: any) => rule.min(1).error("Add at least 1 question."),
    }),
  ],
  preview: {
    select: { questions: "questions" },
    prepare: ({ questions }: any) => ({
      title: `Quiz (${(questions || []).length} question${
        (questions || []).length === 1 ? "" : "s"
      })`,
    }),
  },
});

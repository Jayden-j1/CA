// cms/schemas/lesson.js
//
// Purpose:
// - Defines the lesson-level schema with multimedia, PDF resources,
//   and interactive content like quizzes or sliders.
// - Supports both local and Mux video uploads.

import { defineType, defineField } from "sanity";

export default defineType({
  name: "lesson",
  title: "Lesson",
  type: "document",
  fields: [
    // Lesson title
    defineField({ name: "title", type: "string", title: "Lesson Title" }),

    // Embedded video from YouTube, Vimeo, or Canva
    defineField({
      name: "embed",
      title: "Embedded Video",
      type: "object",
      fields: [
        { name: "title", type: "string" },
        { name: "url", type: "url", title: "Embed URL" },
        {
          name: "provider",
          type: "string",
          options: {
            list: [
              { title: "YouTube", value: "YouTube" },
              { title: "Vimeo", value: "Vimeo" },
              { title: "Canva", value: "Canva" },
              { title: "Custom", value: "Custom" },
            ],
          },
        },
      ],
    }),

    // Direct MP4 upload (self-recorded)
    defineField({
      name: "videoFile",
      title: "Upload Lesson Video",
      type: "file",
      options: { accept: "video/*" },
      description:
        "Upload your own recorded video (MP4, MOV, WEBM). Recommended under 200MB.",
    }),

    // Mux streaming video (for longer lessons)
    defineField({
      name: "muxVideo",
      title: "Mux Video (for large lessons)",
      type: "mux.video",
      description: "For high-quality or long videos (uses adaptive streaming).",
    }),

    // PDF handouts or guides
    defineField({
      name: "resources",
      title: "Lesson Resources (PDFs, Handouts)",
      type: "array",
      of: [{ type: "file" }],
    }),

    // Interactive body content
    defineField({
      name: "body",
      title: "Lesson Content",
      type: "array",
      of: [
        { type: "block" },
        { type: "image", options: { hotspot: true } },
        {
          name: "callout",
          title: "Callout Box",
          type: "object",
          fields: [
            { name: "text", type: "text", title: "Text" },
            {
              name: "tone",
              type: "string",
              options: {
                list: [
                  { title: "Info (blue)", value: "info" },
                  { title: "Warning (amber)", value: "warning" },
                  { title: "Success (green)", value: "success" },
                ],
              },
              initialValue: "info",
            },
          ],
        },
        {
          name: "quiz",
          title: "Quiz",
          type: "object",
          fields: [
            { name: "question", type: "string" },
            {
              name: "options",
              type: "array",
              of: [{ type: "string" }],
              validation: (Rule) => Rule.min(2),
            },
            { name: "correctIndex", type: "number" },
          ],
        },
        {
          name: "slider",
          title: "Slider Input",
          type: "object",
          fields: [
            { name: "prompt", type: "string" },
            { name: "min", type: "number", initialValue: 0 },
            { name: "max", type: "number", initialValue: 10 },
            {
              name: "labels",
              type: "array",
              of: [{ type: "string" }],
              description: "Optional labels for min/max points",
            },
          ],
        },
      ],
    }),
  ],
});

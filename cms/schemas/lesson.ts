// cms/schemas/lesson.ts
//
// Purpose
// -------
// Defines the Lesson document type plus three reusable object types
// (callout, quiz, slider) that can be inserted into the lesson body.
//
// Why this structure?
// -------------------
// Sanity's TypeScript types are strict about array member definitions.
// To avoid the "not assignable to ArrayOfType" errors, we:
//  1) Declare object types (callout, quiz, slider) as top-level `defineType`.
//  2) Register them in the Studio schema (sanity.config.ts).
//  3) Reference them by name in `body.of`, e.g. { type: "callout" }.
//
// Pillars
// -------
// - Simplicity: single file contains lesson + related block types.
// - Robustness: strong validation on key fields.
// - Ease of management: object types are reusable in future schemas.
// - Security: nothing here exposes secrets; content-only definitions.

import { defineType, defineField } from "sanity";

// ---------------------------------------------
// Reusable object types used inside lesson.body
// ---------------------------------------------

export const calloutType = defineType({
  name: "callout",
  title: "Callout Box",
  type: "object",
  fields: [
    defineField({
      name: "text",
      title: "Text",
      type: "text",
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: "tone",
      title: "Tone",
      type: "string",
      options: {
        list: [
          { title: "Info (blue)", value: "info" },
          { title: "Warning (amber)", value: "warning" },
          { title: "Success (green)", value: "success" },
        ],
        layout: "radio",
      },
      initialValue: "info",
    }),
  ],
});

export const quizType = defineType({
  name: "quiz",
  title: "Quiz",
  type: "object",
  fields: [
    defineField({
      name: "question",
      title: "Question",
      type: "string",
      validation: (Rule) => Rule.required().min(5),
    }),
    defineField({
      name: "options",
      title: "Options",
      type: "array",
      of: [{ type: "string" }],
      validation: (Rule) => Rule.required().min(2),
    }),
    defineField({
      name: "correctIndex",
      title: "Correct Option Index",
      type: "number",
      description: "Zero-based index of the correct answer.",
      validation: (Rule) => Rule.required().min(0),
    }),
  ],
});

export const sliderType = defineType({
  name: "slider",
  title: "Slider Input",
  type: "object",
  fields: [
    defineField({
      name: "prompt",
      title: "Prompt / Label",
      type: "string",
      validation: (Rule) => Rule.required().min(3),
    }),
    defineField({
      name: "min",
      title: "Minimum Value",
      type: "number",
      initialValue: 0,
    }),
    defineField({
      name: "max",
      title: "Maximum Value",
      type: "number",
      initialValue: 10,
      validation: (Rule) => Rule.min(1),
    }),
    defineField({
      name: "labels",
      title: "Optional Labels (e.g. Low/High)",
      type: "array",
      of: [{ type: "string" }],
      description: "Provide two labels [minLabel, maxLabel] if desired.",
      // Optional: Validate at most 2 labels
      validation: (Rule) => Rule.max(2),
    }),
  ],
});

// ---------------------------------------------
// Lesson document type
// ---------------------------------------------
const lesson = defineType({
  name: "lesson",
  title: "Lesson",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Lesson Title",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),

    // 1) Either use an embedded video URL (YouTube, Vimeo, Canva, etc.)
    defineField({
      name: "embed",
      title: "Embedded Video",
      type: "object",
      fields: [
        defineField({ name: "title", title: "Title", type: "string" }),
        defineField({
          name: "url",
          title: "Embed URL",
          type: "url",
          description:
            "Paste the share/embed URL (YouTube, Vimeo, Canva, etc.).",
        }),
        defineField({
          name: "provider",
          title: "Provider",
          type: "string",
          options: {
            list: [
              { title: "YouTube", value: "YouTube" },
              { title: "Vimeo", value: "Vimeo" },
              { title: "Canva", value: "Canva" },
              { title: "Custom", value: "Custom" },
            ],
            layout: "radio",
          },
        }),
      ],
    }),

    // 2) Or upload a small/medium video file directly (CDN-hosted by Sanity)
    defineField({
      name: "videoFile",
      title: "Upload Lesson Video",
      type: "file",
      options: { accept: "video/*" },
      description:
        "Upload your own recorded video (MP4, MOV, WEBM). Recommended under ~200 MB.",
    }),

    // 3) Or use Mux for high quality / long-form playback (requires mux plugin)
    defineField({
      name: "muxVideo",
      title: "Mux Video (for long/high-quality lessons)",
      type: "mux.video",
    }),

    // Optional PDFs / resources (e.g. Canva exports, handouts)
    defineField({
      name: "resources",
      title: "Lesson Resources (PDFs, Handouts)",
      type: "array",
      of: [{ type: "file" }],
      options: { layout: "grid" },
    }),

    // Rich text + images + interactive blocks
    defineField({
      name: "body",
      title: "Lesson Content",
      type: "array",
      of: [
        { type: "block" }, // Normal rich text blocks (headings, lists, links, etc.)
        { type: "image", options: { hotspot: true } },
        { type: "callout" }, // Registered above and in schema types
        { type: "quiz" },    // Registered above and in schema types
        { type: "slider" },  // Registered above and in schema types
      ],
    }),
  ],
});

export default lesson;

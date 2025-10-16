// lib/sanity/schemaTypes/lesson.ts
//
// Purpose
// -------
// A single lesson with:
//  • title (required)
//  • order (optional numeric sorting helper)
//  • videoUrl (optional; top-of-lesson video, played by <VideoPlayer />)
//  • body (Portable Text) – supports rich text, images, inline videoEmbed, callout, code
//  • quiz (optional)
//
// Notes
// -----
// • `image` block includes author-facing `alt` + `caption` fields (accessibility-first).
// • `videoEmbed` is a simple object with a URL and caption (defined below in /objects).
// • `callout` is a lightweight annotation object for tips/warnings (also in /objects).
// • You can always add more block/object types later as your content grows.

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
      name: "order",
      title: "Order",
      type: "number",
      description:
        "Optional ordering helper (0..9999). If omitted, parent array order is used.",
      validation: (rule) => rule.min(0).max(9999),
    }),
    defineField({
      name: "videoUrl",
      title: "Top-level Video URL (optional)",
      type: "url",
      description:
        "Shown above the body by the page (YouTube, Vimeo, Mux, etc.). You can ALSO embed videos inline inside the body using the Video Embed block.",
    }),
    defineField({
      name: "body",
      title: "Lesson Body",
      type: "array",
      // ✅ Portable Text can mix blocks + custom objects.
      // We allow:
      //  - block (headings/paragraphs/lists)
      //  - image (with hotspot + fields)
      //  - videoEmbed (custom object)
      //  - callout (custom object)
      //  - code (block type)
      of: [
        { type: "block" },
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            {
              name: "alt",
              type: "string",
              title: "Alternative text",
              description:
                "Describe the image for screen readers and SEO. Leave empty only if decorative.",
              validation: (rule) => rule.max(180),
            },
            {
              name: "caption",
              type: "string",
              title: "Caption",
              validation: (rule) => rule.max(180),
            },
          ],
        },
        { type: "videoEmbed" }, // defined in /objects/videoEmbed.ts
        { type: "callout" },    // defined in /objects/callout.ts
        { type: "code" },       // built-in Sanity code block
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "quiz",
      title: "Quiz (optional)",
      type: "quiz",
    }),
  ],
  preview: {
    select: { title: "title", order: "order" },
    prepare: ({ title, order }) => ({
      title: title || "Untitled Lesson",
      subtitle: typeof order === "number" ? `#${order}` : undefined,
    }),
  },
});

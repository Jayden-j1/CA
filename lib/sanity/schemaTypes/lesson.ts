// lib/sanity/schemaTypes/lesson.ts
//
// Purpose
// -------
// A single lesson with:
//  • title (required)
//  • videoUrl (optional; rendered by your <VideoPlayer /> above the body)
//  • body (Portable Text) – supports rich text, images (with alt/caption),
//    and inline video embeds (videoEmbed object)
//  • quiz (optional)
//  • order (optional) – numeric helper (0..9999) if you want to sort inside modules
//
// Rendering
// ---------
// <PortableTextRenderer /> will render:
//  • blocks (headings/paragraphs/lists)
//  • images (via @sanity/image-url → urlFor())
//  • inline videoEmbed objects (via <VideoPlayer />)
//  • code/callouts if you add them later.
//
// Pillars
// -------
// • Robustness: validation + strong defaults
// • Simplicity: one place to set body structure
// • Ease of management: optional `order` to sort when needed

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
      title: "Order (optional)",
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
      // Allow blocks + images + custom videoEmbed objects
      of: [
        { type: "block" },
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            // ALT text for accessibility
            defineField({
              name: "alt",
              title: "Alt text",
              type: "string",
              description:
                "Describe the image for screen readers and SEO. Keep it concise.",
              validation: (rule) => rule.max(160),
            }),
            // Optional caption shown under the image
            defineField({
              name: "caption",
              title: "Caption",
              type: "string",
              validation: (rule) => rule.max(200),
            }),
          ],
        },
        { type: "videoEmbed" }, // inline video objects
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

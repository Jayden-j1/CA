// lib/sanity/schemaTypes/lesson.ts
//
// Purpose
// -------
// A single lesson with:
//  • title (required)
//  • videoUrl (optional; used by your <VideoPlayer /> at the top)
//  • body (Portable Text) – supports rich text, images, and inline video embeds
//  • quiz (optional)
//  • order (optional) – if you ever sort lessons outside of array order
//
// Rendering
// ---------
// <PortableTextRenderer /> will render:
//  • blocks (headings/paragraphs/lists)
//  • images (via @sanity/image-url)
//  • inline videoEmbed objects (via your <VideoPlayer />)
//  • anything else you add later.

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
      // Allow blocks + images + custom videoEmbed objects
      of: [{ type: "block" }, { type: "image", options: { hotspot: true } }, { type: "videoEmbed" }],
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

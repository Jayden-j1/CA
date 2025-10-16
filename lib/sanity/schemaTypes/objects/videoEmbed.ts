// lib/sanity/schemaTypes/videoEmbed.ts
//
// Purpose
// -------
// Enable inline video embeds *inside* lesson body (Portable Text).
// Authors paste a URL (YouTube/Vimeo/Mux/CDN). Your PT renderer will
// render this with <VideoPlayer /> inline.
//
// Pillars
// -------
// • Simplicity: single URL + optional caption.
// • Robustness: basic URL validation.
// • Ease of management: clear title/description.

import { defineType, defineField } from "sanity";

export const videoEmbed = defineType({
  name: "videoEmbed",
  title: "Video Embed",
  type: "object",
  fields: [
    defineField({
      name: "url",
      title: "Video URL",
      type: "url",
      validation: (rule) =>
        rule.required().uri({
          allowRelative: false,
          scheme: ["http", "https"],
        }),
      description:
        "Paste a direct video URL (YouTube, Vimeo, Mux, or your CDN).",
    }),
    defineField({
      name: "caption",
      title: "Caption (optional)",
      type: "string",
    }),
  ],
  preview: {
    select: { title: "url" },
    prepare: ({ title }) => ({
      title: title || "Video",
      subtitle: "Inline video embed",
    }),
  },
});

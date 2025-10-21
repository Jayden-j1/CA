// lib/sanity/schemaTypes/videoEmbed.ts
//
// Purpose
// -------
// Enable inline video embeds *inside* lesson body (Portable Text).
// Authors paste a URL (YouTube/Vimeo/Mux/CDN). Your PT renderer will
// render this with <VideoPlayer /> inline.
//
// Why these typing changes?
// -------------------------
// We annotate validation `rule` params and preview.prepare params as `any` to
// avoid implicit-any errors in strict TS builds. No runtime behavior change.
//
// Pillars
// -------
// • Simplicity: single URL + optional caption
// • Robustness: basic URL validation
// • Ease of management: clear title/description

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
      // ✅ Type rule as any to satisfy strict TS
      validation: (rule: any) =>
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
    // ✅ Type param as any to avoid implicit-any on destructuring
    prepare: ({ title }: any) => ({
      title: title || "Video",
      subtitle: "Inline video embed",
    }),
  },
});

// lib/sanity/schemaTypes/objects/videoEmbed.ts
//
// Purpose
// -------
// Inline video embed object for Portable Text.
// Editors can place a video URL + optional caption right in the flow.
//
// Rendered by <PortableTextRenderer /> using <VideoPlayer />.

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
      description: "YouTube/Vimeo/Mux (or other embeddable URL).",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "caption",
      title: "Caption (optional)",
      type: "string",
      validation: (rule) => rule.max(180),
    }),
  ],
  preview: {
    select: { url: "url", caption: "caption" },
    prepare: ({ url, caption }) => ({
      title: caption || "Video",
      subtitle: url || "",
    }),
  },
});

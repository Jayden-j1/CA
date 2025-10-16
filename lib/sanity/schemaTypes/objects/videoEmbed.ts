// lib/sanity/schemaTypes/objects/videoEmbed.ts
//
// Purpose
// -------
// Custom Portable Text object that embeds a playable video by URL
// directly inside the lesson body (no redirect).
//
// Supported URLs
// --------------
// Any URL your <VideoPlayer /> supports (YouTube, Vimeo, Mux, direct MP4, etc.)

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
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "caption",
      title: "Caption (optional)",
      type: "string",
    }),
  ],
  preview: {
    select: { url: "url", caption: "caption" },
    prepare: ({ url, caption }) => ({
      title: caption || "Embedded video",
      subtitle: url || "",
    }),
  },
});

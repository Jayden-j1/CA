// lib/sanity/schemaTypes/objects/callout.ts
//
// Purpose
// -------
// Lightweight "callout" box authors can drop into Portable Text.
// Useful for notes, tips, warnings, etc.
//
// Rendered by <PortableTextRenderer /> as a styled panel.

import { defineType, defineField } from "sanity";

export const callout = defineType({
  name: "callout",
  title: "Callout",
  type: "object",
  fields: [
    defineField({
      name: "tone",
      title: "Tone",
      type: "string",
      options: {
        list: [
          { title: "Note", value: "note" },
          { title: "Tip", value: "tip" },
          { title: "Warning", value: "warning" },
        ],
        layout: "radio",
      },
      initialValue: "note",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.max(100),
    }),
    defineField({
      name: "body",
      title: "Text",
      type: "text",
      rows: 3,
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: { tone: "tone", title: "title" },
    prepare: ({ tone, title }) => ({
      title: title || (tone ? tone.toUpperCase() : "Callout"),
      subtitle: tone ? `${tone}` : undefined,
    }),
  },
});

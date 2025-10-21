// lib/sanity/schemaTypes/objects/callout.ts
//
// Purpose
// -------
// Lightweight "callout" box authors can drop into Portable Text.
// Useful for notes, tips, warnings, etc. Rendered by <PortableTextRenderer />.
//
// Why these typing changes?
// -------------------------
// In strict TS builds, Sanity's validation callback parameter (`rule`) and
// preview.prepare destructuring can trigger implicit-any errors. We annotate
// them as `any` to keep the build happy without adding extra type packages.
//
// Pillars
// -------
// • Efficiency: minimal fields, simple options
// • Robustness: required tone, optional title, required body
// • Simplicity: single, focused object schema
// • Ease of management: same pattern as other schemas

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
      // ✅ Explicitly type rule as `any` to avoid implicit-any error
      validation: (rule: any) => rule.required(),
    }),
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule: any) => rule.max(100),
    }),
    defineField({
      name: "body",
      title: "Text",
      type: "text",
      rows: 3,
      validation: (rule: any) => rule.required().min(1),
    }),
  ],
  preview: {
    select: { tone: "tone", title: "title" },
    // ✅ Type as any so destructured props aren’t implicit-any
    prepare: ({ tone, title }: any) => ({
      title: title || (tone ? tone.toUpperCase() : "Callout"),
      subtitle: tone ? `${tone}` : undefined,
    }),
  },
});

// cms/schemas/module.legacy.ts
//
// Purpose
// -------
// Register a *hidden* legacy alias so existing documents with _type "courseModule"
// (created back when Studio loaded lib/sanity/schemaTypes) continue to resolve,
// preview, and validate. This does NOT migrate any data and does NOT change app logic.
//
// Why it's hidden in the desk:
// ----------------------------
// We’ll keep the desk sidebar showing only Course, Module, Lesson, Resource via a
// custom structure (see cms/sanity.config.ts). This type remains registered so
// references work, but users won’t create new legacy docs.
//
// Notes
// -----
// • Fields mirror your modern Module schema closely and include the optional
//   `thumbnail` so old docs can also add an image if desired.
// • Zero impact on frontend (your app fetches via GROQ, not Studio-only names).

import { defineType, defineField } from "sanity";

export const courseModuleLegacy = defineType({
  name: "courseModule",                 // ← legacy _type already in your dataset
  title: "Module (legacy)",             // only visible if you explicitly add it to the desk
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Module Title",
      type: "string",
      validation: (rule: any) => rule.required(),
    }),
    // Keep parity with new module schema so old docs can store thumbnails too
    defineField({
      name: "thumbnail",
      title: "Module Thumbnail (optional)",
      type: "image",
      options: { hotspot: true },
      description:
        "Optional thumbnail image to display beside the module title.",
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "order",
      title: "Order (optional)",
      type: "number",
      description:
        "Optional ordering helper. If omitted, parent array order is used.",
      validation: (rule: any) => rule.min(0).integer(),
    }),
    defineField({
      name: "lessons",
      title: "Lessons",
      type: "array",
      of: [{ type: "reference", to: [{ type: "lesson" }] }],
      validation: (rule: any) => rule.unique(),
    }),
    defineField({
      name: "submodules",
      title: "Submodules",
      type: "array",
      of: [{ type: "reference", to: [{ type: "courseModule" }] }],
      validation: (rule: any) => rule.unique(),
      description:
        "Optional nested submodules (legacy).",
    }),
  ],
});









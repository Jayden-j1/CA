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









// // cms/schemas/module.legacy.ts
// //
// // Purpose
// // -------
// // Register *legacy* document type names so existing references
// // continue to resolve in Studio. Some older content may use
// // "Module" (capital M) or "modules" (plural) as the _type.
// //
// // This file *does not* change your app, progress, or payment logic.
// // It only lets Studio understand those legacy docs so the
// // Course → modules[] array no longer shows “Document of invalid type”.

// import { defineField, defineType } from "sanity";
// import type { Rule as SanityRule } from "@sanity/types";

// // Shared field set (kept identical to the real "module" schema)
// const baseFields = [
//   defineField({
//     name: "title",
//     title: "Module Title",
//     type: "string",
//     validation: (rule: SanityRule) => rule.required(),
//   }),
//   defineField({
//     name: "thumbnail",
//     title: "Module Thumbnail (optional)",
//     type: "image",
//     description: "Optional thumbnail image to display beside the module title.",
//     options: { hotspot: true },
//   }),
//   defineField({
//     name: "description",
//     title: "Description",
//     type: "text",
//     rows: 3,
//   }),
//   defineField({
//     name: "order",
//     title: "Order",
//     type: "number",
//     description: "Optional order index used to sort modules within a course.",
//     validation: (rule: SanityRule) => rule.min(0).integer(),
//   }),
//   defineField({
//     name: "lessons",
//     title: "Lessons",
//     type: "array",
//     of: [{ type: "reference", to: [{ type: "lesson" }] }],
//     validation: (rule: SanityRule) => rule.unique(),
//   }),
//   defineField({
//     name: "submodules",
//     title: "Submodules",
//     type: "array",
//     of: [{ type: "reference", to: [{ type: "module" }] }],
//     validation: (rule: SanityRule) => rule.unique(),
//   }),
// ];

// // Legacy *uppercase* alias (existing docs might have _type === "Module")
// export const moduleLegacyUppercase = defineType({
//   name: "Module", // <- legacy name
//   title: "Module (legacy)",
//   type: "document",
//   // Prevent creating new legacy docs; allow viewing/updating/publishing existing ones
//   __experimental_actions: ["update", "publish"],
//   fields: baseFields,
// });

// // Legacy *plural* alias (existing docs might have _type === "modules")
// export const moduleLegacyPlural = defineType({
//   name: "modules", // <- legacy name
//   title: "Module (legacy plural)",
//   type: "document",
//   __experimental_actions: ["update", "publish"],
//   fields: baseFields,
// });

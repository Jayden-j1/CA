// cms/schemas/module.ts
//
// Purpose
// -------
// Define the Module document schema for Sanity v3+, now including an
// optional thumbnail image for UI display.
//
// This change is purely additive: it introduces a `thumbnail` field
// (type: image) so each module can optionally store an image.
//
// Pillars
// -------
// ✅ Efficiency  – Minimal new field, optional, lazy-loaded
// ✅ Robustness  – Full validation typing (SanityRule)
// ✅ Simplicity  – Mirrors existing image patterns
// ✅ Ease of mgmt – Non-breaking addition, no migration needed
// ✅ Security    – No additional permissions or logic changes

import { defineField, defineType } from "sanity";
import type { Rule as SanityRule } from "@sanity/types";

export default defineType({
  name: "module",
  title: "Module",
  type: "document",

  fields: [
    // --------------------------------------------------------
    // 🏷️ Title
    // --------------------------------------------------------
    defineField({
      name: "title",
      title: "Module Title",
      type: "string",
      validation: (rule: SanityRule) => rule.required(),
    }),

    // --------------------------------------------------------
    // 🖼️ Thumbnail (NEW)
    // --------------------------------------------------------
    defineField({
      name: "thumbnail",
      title: "Module Thumbnail (optional)",
      type: "image",
      description: "Optional thumbnail image to display beside the module title.",
      options: { hotspot: true }, // Enables crop/zoom focus in Studio
    }),

    // --------------------------------------------------------
    // 📝 Description (optional)
    // --------------------------------------------------------
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
    }),

    // --------------------------------------------------------
    // 🔢 Order (optional)
    // --------------------------------------------------------
    defineField({
      name: "order",
      title: "Order",
      type: "number",
      description: "Optional order index used to sort modules within a course.",
      validation: (rule: SanityRule) => rule.min(0).integer(),
    }),

    // --------------------------------------------------------
    // 📚 Lessons
    // --------------------------------------------------------
    defineField({
      name: "lessons",
      title: "Lessons",
      type: "array",
      of: [{ type: "reference", to: [{ type: "lesson" }] }],
      validation: (rule: SanityRule) => rule.unique(),
    }),

    // --------------------------------------------------------
    // 🧩 Submodules (optional)
    // --------------------------------------------------------
    defineField({
      name: "submodules",
      title: "Submodules",
      type: "array",
      of: [{ type: "reference", to: [{ type: "module" }] }],
      validation: (rule: SanityRule) => rule.unique(),
    }),
  ],
});









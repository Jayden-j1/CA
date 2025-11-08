// cms/schemas/module.ts
//
// Purpose
// -------
// Define the Module document schema for Sanity v3+, now with an OPTIONAL
// `thumbnail` image that the UI can display next to the module title.
// This is a pure content-model change; it doesn't alter any app logic.
//
// Pillars
// -------
// ✅ Efficiency  – Minimal field add
// ✅ Robustness  – Strong TS types for validation rules
// ✅ Simplicity  – Mirrors other schemas
// ✅ Ease of mgmt – Editors can drop an image per module if desired
// ✅ Safety     – Optional, so existing content is unaffected

import { defineField, defineType } from "sanity";
import type { Rule as SanityRule } from "@sanity/types";

export default defineType({
  name: "module",
  title: "Module",
  type: "document",

  fields: [
    // 🏷️ Title
    defineField({
      name: "title",
      title: "Module Title",
      type: "string",
      validation: (rule: SanityRule) => rule.required(),
    }),

    // 🖼️ NEW: Optional thumbnail for UI (used in sidebar list)
    // - hotspot enables proper cropping in Studio
    defineField({
      name: "thumbnail",
      title: "Thumbnail",
      type: "image",
      options: { hotspot: true },
      description:
        "Optional image shown next to the module title in the course sidebar.",
    }),

    // 📝 Description (optional)
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
      // validation: (rule: SanityRule) => rule.max(500)
    }),

    // 🔢 Order (optional) – helps sort modules inside a course
    defineField({
      name: "order",
      title: "Order",
      type: "number",
      description: "Optional order index used to sort modules within a course.",
      validation: (rule: SanityRule) => rule.min(0).integer(),
    }),

    // 📚 Lessons – array of refs to lesson docs
    defineField({
      name: "lessons",
      title: "Lessons",
      type: "array",
      of: [{ type: "reference", to: [{ type: "lesson" }] }],
      validation: (rule: SanityRule) => rule.unique(),
    }),

    // 🧩 Submodules (optional) – nested references
    defineField({
      name: "submodules",
      title: "Submodules",
      type: "array",
      of: [{ type: "reference", to: [{ type: "module" }] }],
      validation: (rule: SanityRule) => rule.unique(),
    }),
  ],
});









// // cms/schemas/module.ts
// //
// // Purpose
// // -------
// // Define the Module document schema for Sanity v3+,
// // with correct TypeScript typing for validation callbacks.
// //
// // Why this change?
// // ----------------
// // The build error:
// //   "Parameter 'Rule' implicitly has an 'any' type."
// // arises because the validation callback parameter must be typed.
// // Importing `Rule` from `@sanity/types` and using it in the
// // validation arrow functions resolves the error.
// //
// // Pillars
// // -------
// // ✅ Efficiency  – Minimal schema with only the needed fields
// // ✅ Robustness  – Strong TS types for validation rules
// // ✅ Simplicity  – Consistent pattern; easy to replicate
// // ✅ Ease of mgmt – Mirrors the approach used in lesson.ts
// // ✅ Security    – Explicit field definitions, no wildcards

// import { defineField, defineType } from "sanity";
// // ✅ Use the canonical type source for Sanity schema validation
// import type { Rule as SanityRule } from "@sanity/types";

// export default defineType({
//   name: "module",
//   title: "Module",
//   type: "document",

//   fields: [
//     // --------------------------------------------------------
//     // 🏷️ Title
//     // --------------------------------------------------------
//     defineField({
//       name: "title",
//       title: "Module Title",
//       type: "string",
//       // ✅ Type the validation callback parameter
//       validation: (rule: SanityRule) => rule.required(),
//     }),

//     // --------------------------------------------------------
//     // 📝 Description (optional)
//     // --------------------------------------------------------
//     defineField({
//       name: "description",
//       title: "Description",
//       type: "text",
//       rows: 3,
//       // (Optional) You can add validation here if desired:
//       // validation: (rule: SanityRule) => rule.max(500)
//     }),

//     // --------------------------------------------------------
//     // 🔢 Order (optional)
//     // Helps sort modules inside a course.
//     // --------------------------------------------------------
//     defineField({
//       name: "order",
//       title: "Order",
//       type: "number",
//       description: "Optional order index used to sort modules within a course.",
//       validation: (rule: SanityRule) => rule.min(0).integer(),
//     }),

//     // --------------------------------------------------------
//     // 📚 Lessons
//     // Array of references to lesson documents
//     // --------------------------------------------------------
//     defineField({
//       name: "lessons",
//       title: "Lessons",
//       type: "array",
//       of: [{ type: "reference", to: [{ type: "lesson" }] }],
//       // Unique ensures you don't accidentally reference the same lesson twice
//       validation: (rule: SanityRule) => rule.unique(),
//     }),

//     // --------------------------------------------------------
//     // 🧩 Submodules (optional)
//     // Array of references to other modules (nested structure)
//     // --------------------------------------------------------
//     defineField({
//       name: "submodules",
//       title: "Submodules",
//       type: "array",
//       of: [{ type: "reference", to: [{ type: "module" }] }],
//       validation: (rule: SanityRule) => rule.unique(),
//     }),
//   ],
// });

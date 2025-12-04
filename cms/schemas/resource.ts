// cms/schemas/resource.ts
//
// Purpose
// -------
// Define the "Cultural Resource" document used to store external links
// (articles, websites, videos, etc.) that you may surface in your app.
//
// Why this change?
// ----------------
// The original schema was functionally fine, but it did not restrict
// the URL field to safe schemes. In rare cases, a "javascript:" or other
// non-HTTP(S) URL could be saved and later rendered as an <a> tag in the
// front-end, which is not ideal from a security perspective.
//
// This update is a *small, targeted hardening*:
//  - Title: required, with a minimum length.
//  - URL: must be a valid absolute URL with scheme http or https.
//  - Description: still optional, but we gently cap the length.
//
// No runtime logic or flows change — only Studio validation is improved.
// Existing documents with valid http/https URLs continue to work as-is.
//
// Pillars
// -------
// ✅ Efficiency  – minimal extra validation logic
// ✅ Robustness  – prevents invalid / unsafe URLs from being saved
// ✅ Simplicity  – tiny, self-contained schema
// ✅ Ease of mgmt – consistent validation pattern with other schemas
// ✅ Security    – restricts URL schemes to http/https only

import { defineType, defineField } from "sanity";
import type { Rule as SanityRule } from "@sanity/types";

export default defineType({
  name: "resource",
  title: "Cultural Resource",
  type: "document",

  fields: [
    // --------------------------------------------------------
    // 🏷️ Title (required)
    // --------------------------------------------------------
    defineField({
      name: "title",
      type: "string",
      title: "Title",
      description: "Short, human-readable name for this resource.",
      // Require a non-trivial title (3+ characters).
      validation: (rule: SanityRule) => rule.required().min(3).max(140),
    }),

    // --------------------------------------------------------
    // 🔗 Resource Link (URL)
    // --------------------------------------------------------
    defineField({
      name: "url",
      type: "url",
      title: "Resource Link",
      description:
        "Direct link to the resource (article, website, video, PDF, etc.).",
      //
      // Security hardening:
      // - We only allow absolute URLs with scheme http or https.
      // - This prevents saving javascript: or other odd schemes that
      //   could be dangerous if rendered in the app.
      //
      validation: (rule: SanityRule) =>
        rule
          .required()
          .uri({
            allowRelative: false, // must be absolute
            scheme: ["http", "https"],
          }),
    }),

    // --------------------------------------------------------
    // 📝 Description (optional)
    // --------------------------------------------------------
    defineField({
      name: "description",
      type: "text",
      title: "Description",
      description:
        "Optional context about why this resource is useful or how it should be used.",
      //
      // Optional, but if present, keep it to a reasonable length.
      //
      validation: (rule: SanityRule) => rule.max(1000),
    }),
  ],

  // Optional: a simple preview config so Studio lists look nice.
  preview: {
    select: {
      title: "title",
      url: "url",
    },
    prepare(selection: { title?: string; url?: string }) {
      const { title, url } = selection;
      return {
        title: title || "Untitled Resource",
        subtitle: url || "",
      };
    },
  },
});









// // cms/schemas/resource.ts
// import { defineType, defineField } from "sanity";

// export default defineType({
//   name: "resource",
//   title: "Cultural Resource",
//   type: "document",
//   fields: [
//     defineField({ name: "title", type: "string", title: "Title" }),
//     defineField({ name: "url", type: "url", title: "Resource Link" }),
//     defineField({ name: "description", type: "text", title: "Description" }),
//   ],
// });

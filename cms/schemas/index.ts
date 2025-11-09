// cms/schemas/index.ts
//
// Purpose
// -------
// Register ONLY the document types Studio should know about, plus a hidden legacy
// alias so existing data with _type "courseModule" continues to work.
// We intentionally do NOT register any other legacy variants to avoid duplicate
// lists in the desk sidebar.

import course from "./course";
import module from "./module";
import lesson from "./lesson";
import resource from "./resource";

// ✅ Hidden legacy alias for existing data that still has _type "courseModule"
import { courseModuleLegacy } from "./module.legacy";

export const schemaTypes = [
  course,
  module,
  lesson,
  resource,

  // Keep registered so references resolve, but it will not be shown in the desk
  // thanks to the custom structure in cms/sanity.config.ts.
  courseModuleLegacy,
];









// // cms/schemas/index.ts
// //
// // Purpose
// // -------
// // Export the full set of Sanity schema types that the Studio should load.
// // Previously, only `course` and `resource` were registered, so the Studio
// // never saw updates to the `module` schema (e.g., the new `thumbnail` field).
// //
// // Why this fixes your issue
// // -------------------------
// // Sanity Studio renders fields strictly from the registered schema set.
// // If a document type (like `module`) isn’t exported here, the Studio will
// // fall back to whatever other schema bundle it finds (e.g., a *different*
// // folder like `sanity/schemaTypes`), and your new fields won’t show up.
// //
// // Pillars
// // -------
// // - Simplicity: single export array
// // - Safety: no breaking changes; only adds missing types
// // - Ease of mgmt: mirrors your file layout
// // - Robustness: guarantees the Studio reads the intended schemas

// import course from "./course";
// import module from "./module";
// import lesson from "./lesson";
// import resource from "./resource";

// // ✅ NEW: include legacy aliases so existing documents with legacy _type names
// // (e.g. "Module" or "modules") are recognized by Studio and render correctly.
// // This is **Studio-only** and does not impact your app/frontend logic.
// import { moduleLegacyUppercase, moduleLegacyPlural } from "./module.legacy";

// // If you add more object/doc types later (e.g., quiz, people, etc.),
// // import and append them here. The Studio only sees what you export.
// export const schemaTypes = [
//   course,
//   module,
//   lesson,
//   resource,

//   // ✅ Register legacy types so Course → modules[] refs stay valid in Studio
//   moduleLegacyUppercase,
//   moduleLegacyPlural,
// ];










// // cms/schemas/index.ts
// //
// // Collects all Sanity schema types for modular import.
// // ============================================================

// import course from "./course";
// import resource from "./resource";
// // ✅ Include module & lesson so Studio knows about them
// import moduleDoc from "./module";
// import lesson from "./lesson";

// export const schemaTypes = [course, moduleDoc, lesson, resource];










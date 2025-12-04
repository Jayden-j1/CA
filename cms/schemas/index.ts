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











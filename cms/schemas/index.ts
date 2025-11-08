// cms/schemas/index.ts
//
// Collects all Sanity schema types for modular import.
// ============================================================

import course from "./course";
import resource from "./resource";
// ✅ Include module & lesson so Studio knows about them
import moduleDoc from "./module";
import lesson from "./lesson";

export const schemaTypes = [course, moduleDoc, lesson, resource];









// // cms/schemas/index.ts
// //
// // Collects all Sanity schema types for modular import.
// // ============================================================

// import course from "./course";
// import resource from "./resource";

// export const schemaTypes = [course, resource];

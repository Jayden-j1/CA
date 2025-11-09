// components/course/ModuleList.tsx
//
// Purpose (surgical, UI-only):
// - Keep the improved, slightly larger thumbnails from the last step
// - Add a *small, responsive* font-size bump to the module title text so it
//   visually balances the larger image and improves readability.
// - Do NOT change any course/progress/payment logic.
//
// What changed in THIS revision (vs your last working file):
// 1) The title <span> now has responsive text utilities:
//      - text-[15px] on very small screens (keeps things compact)
//      - sm:text-base (16px) on small screens and up
//      - md:text-[17px] on medium screens and up
//    This is a subtle bump, not “big”. It maintains a modern, clean look.
// 2) We also add `leading-tight` to tighten line-height for a crisper look.
//
// Everything else (locking, completion, navigation, data) remains identical.
//
// Pillars:
// - Efficiency: purely presentational; no extra runtime cost.
// - Robustness: isolated to one span; safe across breakpoints.
// - Simplicity: single-class change; easy to tweak later.
// - Ease of mgmt: richly commented; clear intent.
// - Security: no data/logic changes—UI only.

"use client";

import React from "react";
import Image from "next/image";
import type { CourseModule } from "@/types/course";

interface ModuleListProps {
  modules: CourseModule[];
  currentModuleIndex: number;
  currentLessonIndex: number;

  onSelectModule: (index: number) => void;
  unlockedModuleIndices?: Set<number>;
  onSelectLesson: (moduleIndex: number, lessonIndex: number) => void;
  completedModuleIds?: string[];
}

/**
 * Build a square Sanity CDN URL at the requested pixel size.
 * Ensures sharp thumbnails (no blurry upscaling) and efficient payloads.
 *
 * Appends:
 *   - w=<size> & h=<size>  → exact square
 *   - fit=crop             → center crop
 *   - auto=format          → modern formats when supported
 */
function sizedSanityThumb(raw: string, size: number): string {
  try {
    const url = new URL(raw);
    // Only mutate clearly Sanity-hosted images; otherwise return original URL.
    if (!/(\.|\/)sanity\.io\/?/.test(url.hostname + url.pathname)) return raw;

    const params = url.searchParams;
    params.set("w", String(size));
    params.set("h", String(size));
    params.set("fit", "crop");
    params.set("auto", "format");
    url.search = params.toString();
    return url.toString();
  } catch {
    // If `raw` isn't a valid URL (edge case), fall back to the original string.
    return raw;
  }
}

const ModuleList: React.FC<ModuleListProps> = ({
  modules,
  currentModuleIndex,
  currentLessonIndex,
  onSelectModule,
  unlockedModuleIndices,
  onSelectLesson,
  completedModuleIds,
}) => {
  const safeUnlocked = unlockedModuleIndices ?? new Set<number>([0]);
  const completedIdSet = new Set<string>(completedModuleIds ?? []);

  // Visual thumbnail sizes (unchanged from previous step—just for reference):
  // - 56px on mobile
  // - 64px on small screens and up (sm:)
  const THUMB_MOBILE = 56; // px
  const THUMB_SM_UP = 64;  // px

  return (
    <aside
      className="bg-white/90 rounded-2xl shadow-lg p-4 sm:p-5 space-y-5 overflow-y-auto max-h-[80vh]"
      aria-label="Course modules"
    >
      {modules.map((module, mIdx) => {
        const isActiveModule = mIdx === currentModuleIndex;
        const isUnlocked = safeUnlocked.has(mIdx);
        const isCompleted = completedIdSet.has(module.id);

        return (
          <div
            key={module.id}
            className={`rounded-xl transition-all border ${
              isActiveModule
                ? "border-blue-500 bg-blue-50 shadow-sm"
                : "border-gray-200 hover:border-blue-300"
            } ${!isUnlocked ? "opacity-70" : ""}`}
          >
            {/* Module Header */}
            <button
              onClick={() => isUnlocked && onSelectModule(mIdx)}
              className={`w-full text-left px-4 py-3 font-semibold rounded-t-xl transition-colors flex items-center justify-between ${
                isActiveModule ? "text-blue-900 bg-blue-100" : "text-gray-800 hover:bg-gray-50"
              } ${!isUnlocked ? "cursor-not-allowed" : ""}`}
              aria-current={isActiveModule ? "true" : undefined}
              aria-disabled={!isUnlocked}
              title={!isUnlocked ? "Complete the previous module to unlock" : undefined}
            >
              {/* LEFT: Thumbnail + Title */}
              <span className="flex items-center gap-3">
                {/* Thumbnail (slightly larger, sharp) */}
                {module.thumbnail ? (
                  <span
                    className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-md overflow-hidden border border-blue-200 bg-white flex-none"
                    aria-hidden="true"
                  >
                    <Image
                      src={sizedSanityThumb(module.thumbnail, THUMB_SM_UP)}
                      alt={`${module.title} thumbnail`}
                      fill
                      sizes="(min-width: 640px) 64px, 56px"
                      className="object-cover"
                      quality={85}
                      loading="lazy"
                    />
                  </span>
                ) : (
                  <span className="w-14 h-14 sm:w-16 sm:h-16 rounded-md bg-gradient-to-br from-blue-100 to-blue-200 border border-blue-100 flex-none" />
                )}

                {/* Title + Completed badge */}
                <span className="flex items-center gap-2">
                  {/* ✅ NEW: subtle, responsive font-size bump + tighter line-height.
                      - Very small screens: ~15px keeps row compact.
                      - Small screens and up: 16px (base).
                      - Medium screens and up: 17px for a touch more presence.
                   */}
                  <span className="text-[15px] sm:text-base md:text-[17px] leading-tight">
                    {mIdx + 1}. {module.title}
                  </span>

                  {isCompleted && (
                    <span className="text-[11px] font-medium text-emerald-700">✓ Completed</span>
                  )}
                </span>
              </span>

              {/* RIGHT: Lock indicator (unchanged) */}
              {!isUnlocked && (
                <span
                  className="ml-2 inline-flex items-center text-xs font-medium text-gray-600"
                  aria-hidden="true"
                >
                  🔒 Locked
                </span>
              )}
            </button>

            {/* Lesson List: only render if active AND unlocked. */}
            {isActiveModule && isUnlocked && (
              <ul className="px-4 py-2 space-y-1">
                {(module.lessons ?? []).map((lesson, lIdx) => {
                  const isActiveLesson = isActiveModule && lIdx === currentLessonIndex;

                  return (
                    <li
                      key={lesson.id}
                      className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-all duration-150 ${
                        isActiveLesson
                          ? "bg-blue-600 text-white shadow-sm scale-[1.02]"
                          : "text-gray-700 hover:bg-blue-50 hover:text-blue-900"
                      }`}
                      onClick={() => onSelectLesson(mIdx, lIdx)}
                      role="button"
                      aria-current={isActiveLesson ? "true" : undefined}
                    >
                      {lesson.title}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </aside>
  );
};

export default ModuleList;









// // components/course/ModuleList.tsx
// //
// // Goal (surgical, UI-only):
// // - Make module thumbnails *slightly* larger and crisper, while keeping layout stable,
// //   and without impacting any logic (locking, completion, navigation, payments, etc.)
// //
// // What changed vs your last version:
// // 1) Thumbnail container nudged up one step: 48→56px (mobile) and 56→64px (sm+).
// // 2) `sizes` updated to match the new CSS sizes for optimal Next/Image selection.
// // 3) Still request exact-size images from the Sanity CDN to avoid blur & save bandwidth.
// //
// // Pillars:
// // - Efficiency: fetch only needed pixels via Sanity CDN parameters.
// // - Robustness: helper preserves existing query params; graceful fallbacks.
// // - Simplicity: changes are local; no API/types/logic touched.
// // - Ease of mgmt: single place to tweak sizes; rich comments.
// // - Security: reads only public CDN URLs already in your data.

// "use client";

// import React from "react";
// import Image from "next/image";
// import type { CourseModule } from "@/types/course";

// interface ModuleListProps {
//   modules: CourseModule[];
//   currentModuleIndex: number;
//   currentLessonIndex: number;

//   onSelectModule: (index: number) => void;
//   unlockedModuleIndices?: Set<number>;
//   onSelectLesson: (moduleIndex: number, lessonIndex: number) => void;
//   completedModuleIds?: string[];
// }

// /**
//  * Build a square Sanity CDN URL at the requested pixel size.
//  * Ensures sharp thumbnails (no blurry upscaling) and efficient payloads.
//  *
//  * Appends:
//  *   - w=<size> & h=<size>  → exact square
//  *   - fit=crop             → center crop
//  *   - auto=format          → modern formats when supported
//  */
// function sizedSanityThumb(raw: string, size: number): string {
//   try {
//     const url = new URL(raw);
//     // Only mutate clearly Sanity-hosted images; otherwise return original URL.
//     if (!/(\.|\/)sanity\.io\/?/.test(url.hostname + url.pathname)) return raw;

//     const params = url.searchParams;
//     params.set("w", String(size));
//     params.set("h", String(size));
//     params.set("fit", "crop");
//     params.set("auto", "format");
//     url.search = params.toString();
//     return url.toString();
//   } catch {
//     // If `raw` isn't a valid URL (edge case), fall back to the original string.
//     return raw;
//   }
// }

// const ModuleList: React.FC<ModuleListProps> = ({
//   modules,
//   currentModuleIndex,
//   currentLessonIndex,
//   onSelectModule,
//   unlockedModuleIndices,
//   onSelectLesson,
//   completedModuleIds,
// }) => {
//   const safeUnlocked = unlockedModuleIndices ?? new Set<number>([0]);
//   const completedIdSet = new Set<string>(completedModuleIds ?? []);

//   // New visual sizes (just a little bigger):
//   // - 56px on mobile
//   // - 64px on small screens and up (sm:)
//   const THUMB_MOBILE = 56; // px
//   const THUMB_SM_UP = 64;  // px

//   return (
//     <aside
//       className="bg-white/90 rounded-2xl shadow-lg p-4 sm:p-5 space-y-5 overflow-y-auto max-h-[80vh]"
//       aria-label="Course modules"
//     >
//       {modules.map((module, mIdx) => {
//         const isActiveModule = mIdx === currentModuleIndex;
//         const isUnlocked = safeUnlocked.has(mIdx);
//         const isCompleted = completedIdSet.has(module.id);

//         return (
//           <div
//             key={module.id}
//             className={`rounded-xl transition-all border ${
//               isActiveModule
//                 ? "border-blue-500 bg-blue-50 shadow-sm"
//                 : "border-gray-200 hover:border-blue-300"
//             } ${!isUnlocked ? "opacity-70" : ""}`}
//           >
//             {/* Module Header */}
//             <button
//               onClick={() => isUnlocked && onSelectModule(mIdx)}
//               className={`w-full text-left px-4 py-3 font-semibold rounded-t-xl transition-colors flex items-center justify-between ${
//                 isActiveModule ? "text-blue-900 bg-blue-100" : "text-gray-800 hover:bg-gray-50"
//               } ${!isUnlocked ? "cursor-not-allowed" : ""}`}
//               aria-current={isActiveModule ? "true" : undefined}
//               aria-disabled={!isUnlocked}
//               title={!isUnlocked ? "Complete the previous module to unlock" : undefined}
//             >
//               {/* LEFT: Thumbnail + Title */}
//               <span className="flex items-center gap-3">
//                 {/* ✅ Slightly larger, sharper thumbnail (with graceful fallback) */}
//                 {module.thumbnail ? (
//                   <span
//                     // Fixed-size square; `flex-none` prevents layout shifts to siblings.
//                     className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-md overflow-hidden border border-blue-200 bg-white flex-none"
//                     aria-hidden="true"
//                   >
//                     <Image
//                       // Ask Sanity for the larger of our two sizes; Next will still pick via `sizes`.
//                       src={sizedSanityThumb(module.thumbnail, THUMB_SM_UP)}
//                       alt={`${module.title} thumbnail`}
//                       fill
//                       // Match our CSS sizes for optimal src choice:
//                       // - 64px for >=640px (sm and up)
//                       // - 56px otherwise
//                       sizes="(min-width: 640px) 64px, 56px"
//                       className="object-cover"
//                       quality={85}
//                       loading="lazy"
//                     />
//                   </span>
//                 ) : (
//                   // Subtle placeholder at the new size
//                   <span className="w-14 h-14 sm:w-16 sm:h-16 rounded-md bg-gradient-to-br from-blue-100 to-blue-200 border border-blue-100 flex-none" />
//                 )}

//                 <span className="flex items-center gap-2">
//                   <span>
//                     {mIdx + 1}. {module.title}
//                   </span>
//                   {isCompleted && (
//                     <span className="text-[11px] font-medium text-emerald-700">✓ Completed</span>
//                   )}
//                 </span>
//               </span>

//               {/* RIGHT: Lock indicator (unchanged) */}
//               {!isUnlocked && (
//                 <span
//                   className="ml-2 inline-flex items-center text-xs font-medium text-gray-600"
//                   aria-hidden="true"
//                 >
//                   🔒 Locked
//                 </span>
//               )}
//             </button>

//             {/* Lesson List: only render if active AND unlocked. */}
//             {isActiveModule && isUnlocked && (
//               <ul className="px-4 py-2 space-y-1">
//                 {(module.lessons ?? []).map((lesson, lIdx) => {
//                   const isActiveLesson = isActiveModule && lIdx === currentLessonIndex;

//                   return (
//                     <li
//                       key={lesson.id}
//                       className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-all duration-150 ${
//                         isActiveLesson
//                           ? "bg-blue-600 text-white shadow-sm scale-[1.02]"
//                           : "text-gray-700 hover:bg-blue-50 hover:text-blue-900"
//                       }`}
//                       onClick={() => onSelectLesson(mIdx, lIdx)}
//                       role="button"
//                       aria-current={isActiveLesson ? "true" : undefined}
//                     >
//                       {lesson.title}
//                     </li>
//                   );
//                 })}
//               </ul>
//             )}
//           </div>
//         );
//       })}
//     </aside>
//   );
// };

// export default ModuleList;









// // components/course/ModuleList.tsx
// //
// // Goal (surgical, UI-only):
// // - Make module thumbnails bigger and CRISPER (avoid blur) while keeping the
// //   modern look and not impacting sibling components or any course/progress logic.
// //
// // What changed:
// // 1) Thumbnail container bumped from 32px → 48px (mobile) and 56px (sm+).
// // 2) Added a tiny helper `sizedSanityThumb()` that appends Sanity CDN params
// //    (?w=..&h=..&fit=crop&auto=format) to request a sharp, square image at the
// //    exact display size. This avoids blurry upscaling and keeps bandwidth lean.
// // 3) Updated <Image /> props to use `sizes` that match our CSS, and set
// //    `quality={85}` for better clarity without big payloads.
// // 4) Kept *all* selection / locking / completion logic intact.
// //
// // Pillars:
// // - Efficiency: fetch only the pixels we need via Sanity's CDN parameters.
// // - Robustness: helper preserves existing query params; safe fallbacks.
// // - Simplicity: all changes are local to this file; no API/types/logic changes.
// // - Ease of mgmt: comments + small helper; easy to tweak future sizes.
// // - Security: reads only a public CDN URL already in your data.

// "use client";

// import React from "react";
// import Image from "next/image";
// import type { CourseModule } from "@/types/course";

// interface ModuleListProps {
//   modules: CourseModule[];
//   currentModuleIndex: number;
//   currentLessonIndex: number;

//   onSelectModule: (index: number) => void;
//   unlockedModuleIndices?: Set<number>;
//   onSelectLesson: (moduleIndex: number, lessonIndex: number) => void;
//   completedModuleIds?: string[];
// }

// /**
//  * Build a square Sanity CDN URL at the requested pixel size.
//  * This ensures we download a sharp thumbnail at the exact display size
//  * (prevents blurry upscaling and saves bandwidth).
//  *
//  * We append:
//  *   - w=<size> & h=<size>  → exact square
//  *   - fit=crop             → center crop to square
//  *   - auto=format          → webp/avif where supported
//  *
//  * Notes:
//  * - If `raw` already has query params, we safely append to them.
//  * - If `raw` is not a valid URL (very rare), return it as-is, so we don't
//  *   accidentally break rendering.
//  */
// function sizedSanityThumb(raw: string, size: number): string {
//   try {
//     const url = new URL(raw);
//     // Only if it’s clearly a Sanity CDN URL; otherwise just return original.
//     // This guards against accidental 3rd-party URLs being mutated.
//     if (!/(\.|\/)sanity\.io\/?/.test(url.hostname + url.pathname)) return raw;

//     const params = url.searchParams;
//     params.set("w", String(size));
//     params.set("h", String(size));
//     params.set("fit", "crop");
//     params.set("auto", "format");
//     url.search = params.toString();
//     return url.toString();
//   } catch {
//     return raw;
//   }
// }

// const ModuleList: React.FC<ModuleListProps> = ({
//   modules,
//   currentModuleIndex,
//   currentLessonIndex,
//   onSelectModule,
//   unlockedModuleIndices,
//   onSelectLesson,
//   completedModuleIds,
// }) => {
//   const safeUnlocked = unlockedModuleIndices ?? new Set<number>([0]);
//   const completedIdSet = new Set<string>(completedModuleIds ?? []);

//   // Define the visual thumbnail sizes we actually render:
//   // - 48px on mobile
//   // - 56px on small screens and up (sm:)
//   const THUMB_MOBILE = 48; // px
//   const THUMB_SM_UP = 56;  // px

//   return (
//     <aside
//       className="bg-white/90 rounded-2xl shadow-lg p-4 sm:p-5 space-y-5 overflow-y-auto max-h-[80vh]"
//       aria-label="Course modules"
//     >
//       {modules.map((module, mIdx) => {
//         const isActiveModule = mIdx === currentModuleIndex;
//         const isUnlocked = safeUnlocked.has(mIdx);
//         const isCompleted = completedIdSet.has(module.id);

//         return (
//           <div
//             key={module.id}
//             className={`rounded-xl transition-all border ${
//               isActiveModule
//                 ? "border-blue-500 bg-blue-50 shadow-sm"
//                 : "border-gray-200 hover:border-blue-300"
//             } ${!isUnlocked ? "opacity-70" : ""}`}
//           >
//             {/* Module Header */}
//             <button
//               onClick={() => isUnlocked && onSelectModule(mIdx)}
//               className={`w-full text-left px-4 py-3 font-semibold rounded-t-xl transition-colors flex items-center justify-between ${
//                 isActiveModule ? "text-blue-900 bg-blue-100" : "text-gray-800 hover:bg-gray-50"
//               } ${!isUnlocked ? "cursor-not-allowed" : ""}`}
//               aria-current={isActiveModule ? "true" : undefined}
//               aria-disabled={!isUnlocked}
//               title={!isUnlocked ? "Complete the previous module to unlock" : undefined}
//             >
//               {/* LEFT: Thumbnail + Title */}
//               <span className="flex items-center gap-3">
//                 {/* ✅ Bigger, sharper thumbnail (with graceful fallback) */}
//                 {module.thumbnail ? (
//                   <span
//                     // Fixed-size square that does not affect sibling layout
//                     className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-md overflow-hidden border border-blue-200 bg-white flex-none"
//                     aria-hidden="true"
//                   >
//                     <Image
//                       // Request exactly the displayed pixel size from Sanity CDN to avoid blur
//                       src={sizedSanityThumb(
//                         module.thumbnail,
//                         // Choose size based on the most common case; the `sizes` prop below
//                         // lets Next.js pick the correct resource for the current viewport
//                         THUMB_SM_UP
//                       )}
//                       alt={`${module.title} thumbnail`}
//                       // `fill` + rounded container gives us a clean cover crop
//                       fill
//                       // Let Next/Image pick the appropriate resource width:
//                       // - 56px for >=640px (sm and up)
//                       // - 48px otherwise
//                       sizes="(min-width: 640px) 56px, 48px"
//                       // Cover to keep it contained and avoid distortion
//                       className="object-cover"
//                       // Slightly higher quality to combat compression artifacts without overkill
//                       quality={85}
//                       // Thumbnails are non-critical; keep them lazy for perf
//                       loading="lazy"
//                     />
//                   </span>
//                 ) : (
//                   // Subtle placeholder that matches the theme and final size
//                   <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-md bg-gradient-to-br from-blue-100 to-blue-200 border border-blue-100 flex-none" />
//                 )}

//                 <span className="flex items-center gap-2">
//                   <span>
//                     {mIdx + 1}. {module.title}
//                   </span>
//                   {isCompleted && (
//                     <span className="text-[11px] font-medium text-emerald-700">✓ Completed</span>
//                   )}
//                 </span>
//               </span>

//               {/* RIGHT: Lock indicator (unchanged) */}
//               {!isUnlocked && (
//                 <span
//                   className="ml-2 inline-flex items-center text-xs font-medium text-gray-600"
//                   aria-hidden="true"
//                 >
//                   🔒 Locked
//                 </span>
//               )}
//             </button>

//             {/* Lesson List: only render if active AND unlocked. */}
//             {isActiveModule && isUnlocked && (
//               <ul className="px-4 py-2 space-y-1">
//                 {(module.lessons ?? []).map((lesson, lIdx) => {
//                   const isActiveLesson = isActiveModule && lIdx === currentLessonIndex;

//                   return (
//                     <li
//                       key={lesson.id}
//                       className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-all duration-150 ${
//                         isActiveLesson
//                           ? "bg-blue-600 text-white shadow-sm scale-[1.02]"
//                           : "text-gray-700 hover:bg-blue-50 hover:text-blue-900"
//                       }`}
//                       onClick={() => onSelectLesson(mIdx, lIdx)}
//                       role="button"
//                       aria-current={isActiveLesson ? "true" : undefined}
//                     >
//                       {lesson.title}
//                     </li>
//                   );
//                 })}
//               </ul>
//             )}
//           </div>
//         );
//       })}
//     </aside>
//   );
// };

// export default ModuleList;









// // components/course/ModuleList.tsx
// //
// // Change (surgical):
// // - Display a small 32px thumbnail (rounded) next to each module title,
// //   if `module.thumbnail` is present. If not present, render a subtle
// //   placeholder circle (no behavioral change).
// //
// // No changes to selection, locking, or completion logic.

// "use client";

// import React from "react";
// import Image from "next/image";
// import type { CourseModule } from "@/types/course";

// interface ModuleListProps {
//   modules: CourseModule[];
//   currentModuleIndex: number;
//   currentLessonIndex: number;

//   onSelectModule: (index: number) => void;
//   unlockedModuleIndices?: Set<number>;
//   onSelectLesson: (moduleIndex: number, lessonIndex: number) => void;
//   completedModuleIds?: string[];
// }

// const ModuleList: React.FC<ModuleListProps> = ({
//   modules,
//   currentModuleIndex,
//   currentLessonIndex,
//   onSelectModule,
//   unlockedModuleIndices,
//   onSelectLesson,
//   completedModuleIds,
// }) => {
//   const safeUnlocked = unlockedModuleIndices ?? new Set<number>([0]);
//   const completedIdSet = new Set<string>(completedModuleIds ?? []);

//   return (
//     <aside
//       className="bg-white/90 rounded-2xl shadow-lg p-4 sm:p-5 space-y-5 overflow-y-auto max-h-[80vh]"
//       aria-label="Course modules"
//     >
//       {modules.map((module, mIdx) => {
//         const isActiveModule = mIdx === currentModuleIndex;
//         const isUnlocked = safeUnlocked.has(mIdx);
//         const isCompleted = completedIdSet.has(module.id);

//         return (
//           <div
//             key={module.id}
//             className={`rounded-xl transition-all border ${
//               isActiveModule
//                 ? "border-blue-500 bg-blue-50 shadow-sm"
//                 : "border-gray-200 hover:border-blue-300"
//             } ${!isUnlocked ? "opacity-70" : ""}`}
//           >
//             {/* Module Header */}
//             <button
//               onClick={() => isUnlocked && onSelectModule(mIdx)}
//               className={`w-full text-left px-4 py-3 font-semibold rounded-t-xl transition-colors flex items-center justify-between ${
//                 isActiveModule ? "text-blue-900 bg-blue-100" : "text-gray-800 hover:bg-gray-50"
//               } ${!isUnlocked ? "cursor-not-allowed" : ""}`}
//               aria-current={isActiveModule ? "true" : undefined}
//               aria-disabled={!isUnlocked}
//               title={!isUnlocked ? "Complete the previous module to unlock" : undefined}
//             >
//               {/* LEFT: Thumbnail + Title */}
//               <span className="flex items-center gap-3">
//                 {/* ✅ NEW: Thumbnail (graceful fallback if missing) */}
//                 {module.thumbnail ? (
//                   <span className="relative w-8 h-8 rounded-md overflow-hidden border border-blue-200 bg-white">
//                     <Image
//                       src={module.thumbnail}
//                       alt={`${module.title} thumbnail`}
//                       fill
//                       sizes="32px"
//                       className="object-cover"
//                     />
//                   </span>
//                 ) : (
//                   // Subtle placeholder that blends with the current theme
//                   <span className="w-8 h-8 rounded-md bg-gradient-to-br from-blue-100 to-blue-200 border border-blue-100" />
//                 )}

//                 <span className="flex items-center gap-2">
//                   <span>{mIdx + 1}. {module.title}</span>
//                   {isCompleted && (
//                     <span className="text-[11px] font-medium text-emerald-700">✓ Completed</span>
//                   )}
//                 </span>
//               </span>

//               {/* RIGHT: Lock indicator (unchanged) */}
//               {!isUnlocked && (
//                 <span
//                   className="ml-2 inline-flex items-center text-xs font-medium text-gray-600"
//                   aria-hidden="true"
//                 >
//                   🔒 Locked
//                 </span>
//               )}
//             </button>

//             {/* Lesson List: only render if active AND unlocked. */}
//             {isActiveModule && isUnlocked && (
//               <ul className="px-4 py-2 space-y-1">
//                 {(module.lessons ?? []).map((lesson, lIdx) => {
//                   const isActiveLesson = isActiveModule && lIdx === currentLessonIndex;

//                   return (
//                     <li
//                       key={lesson.id}
//                       className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-all duration-150 ${
//                         isActiveLesson
//                           ? "bg-blue-600 text-white shadow-sm scale-[1.02]"
//                           : "text-gray-700 hover:bg-blue-50 hover:text-blue-900"
//                       }`}
//                       onClick={() => onSelectLesson(mIdx, lIdx)}
//                       role="button"
//                       aria-current={isActiveLesson ? "true" : undefined}
//                     >
//                       {lesson.title}
//                     </li>
//                   );
//                 })}
//               </ul>
//             )}
//           </div>
//         );
//       })}
//     </aside>
//   );
// };

// export default ModuleList;









// // components/course/ModuleList.tsx
// //
// // Purpose
// // -------
// // Display all course modules and lessons in a responsive sidebar.
// //
// // UX in this patch:
// // 1) Modules are visually locked until prior completes (driven by unlockedModuleIndices).
// // 2) Clear locked styling and prevents clicking locked lessons.
// // 3) Supports clicking lessons via onSelectLesson(mIdx, lIdx).
// // 4) Optional: show a small "✓ Completed" badge on modules if parent passes `completedModuleIds`.
// //
// // Props:
// // - modules: CourseModule[]
// // - currentModuleIndex: number
// // - currentLessonIndex: number
// // - onSelectModule(index: number): void
// // - unlockedModuleIndices?: Set<number>   (defaults to Set([0]) for safety)
// // - onSelectLesson(moduleIndex: number, lessonIndex: number): void
// // - completedModuleIds?: string[]         (optional; for display badges only)
// //
// // Pillars
// // -------
// // - Simplicity: Tailwind only, clean prop-driven behavior.
// // - Robustness: safe fallbacks; never crash if props missing.
// // - Accessibility: aria-disabled and cursor/opacity cues.

// "use client";

// import React from "react";
// import type { CourseModule } from "@/types/course";

// interface ModuleListProps {
//   modules: CourseModule[];
//   currentModuleIndex: number;
//   currentLessonIndex: number;

//   onSelectModule: (index: number) => void;

//   // Which module indices are unlocked; if omitted we assume [0] for safety/back-compat
//   unlockedModuleIndices?: Set<number>;

//   // Select a specific lesson within a module
//   onSelectLesson: (moduleIndex: number, lessonIndex: number) => void;

//   // Optional: used to show a "completed" badge on module headers
//   completedModuleIds?: string[];
// }

// const ModuleList: React.FC<ModuleListProps> = ({
//   modules,
//   currentModuleIndex,
//   currentLessonIndex,
//   onSelectModule,
//   unlockedModuleIndices,
//   onSelectLesson,
//   completedModuleIds,
// }) => {
//   // ✅ Defensive defaults:
//   const safeUnlocked = unlockedModuleIndices ?? new Set<number>([0]);
//   const completedIdSet = new Set<string>(completedModuleIds ?? []);

//   return (
//     <aside
//       className="bg-white/90 rounded-2xl shadow-lg p-4 sm:p-5 space-y-5 overflow-y-auto max-h-[80vh]"
//       aria-label="Course modules"
//     >
//       {modules.map((module, mIdx) => {
//         const isActiveModule = mIdx === currentModuleIndex;
//         const isUnlocked = safeUnlocked.has(mIdx);
//         const isCompleted = completedIdSet.has(module.id);

//         return (
//           <div
//             key={module.id}
//             className={`rounded-xl transition-all border ${
//               isActiveModule
//                 ? "border-blue-500 bg-blue-50 shadow-sm"
//                 : "border-gray-200 hover:border-blue-300"
//             } ${!isUnlocked ? "opacity-70" : ""}`}
//           >
//             {/* Module Header */}
//             <button
//               // Only allow switching when the module is unlocked
//               onClick={() => isUnlocked && onSelectModule(mIdx)}
//               className={`w-full text-left px-4 py-3 font-semibold rounded-t-xl transition-colors flex items-center justify-between ${
//                 isActiveModule
//                   ? "text-blue-900 bg-blue-100"
//                   : "text-gray-800 hover:bg-gray-50"
//               } ${!isUnlocked ? "cursor-not-allowed" : ""}`}
//               aria-current={isActiveModule ? "true" : undefined}
//               aria-disabled={!isUnlocked}
//               title={!isUnlocked ? "Complete the previous module to unlock" : undefined}
//             >
//               <span className="flex items-center gap-2">
//                 <span>{mIdx + 1}. {module.title}</span>
//                 {/* Optional completed badge (purely visual) */}
//                 {isCompleted && (
//                   <span className="text-[11px] font-medium text-emerald-700">✓ Completed</span>
//                 )}
//               </span>
//               {!isUnlocked && (
//                 <span
//                   className="ml-2 inline-flex items-center text-xs font-medium text-gray-600"
//                   aria-hidden="true"
//                 >
//                   🔒 Locked
//                 </span>
//               )}
//             </button>

//             {/* Lesson List: only render if active AND unlocked. */}
//             {isActiveModule && isUnlocked && (
//               <ul className="px-4 py-2 space-y-1">
//                 {(module.lessons ?? []).map((lesson, lIdx) => {
//                   const isActiveLesson = isActiveModule && lIdx === currentLessonIndex;

//                   return (
//                     <li
//                       key={lesson.id}
//                       className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-all duration-150 ${
//                         isActiveLesson
//                           ? "bg-blue-600 text-white shadow-sm scale-[1.02]"
//                           : "text-gray-700 hover:bg-blue-50 hover:text-blue-900"
//                       }`}
//                       onClick={() => onSelectLesson(mIdx, lIdx)}
//                       role="button"
//                       aria-current={isActiveLesson ? "true" : undefined}
//                     >
//                       {lesson.title}
//                     </li>
//                   );
//                 })}
//               </ul>
//             )}
//           </div>
//         );
//       })}
//     </aside>
//   );
// };

// export default ModuleList;

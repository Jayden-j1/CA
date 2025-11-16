// components/course/ModuleList.tsx
//
// Purpose (surgical, UI-only):
// - Keep circular thumbnails, make them look clean with transparent PNGs,
//   and add a gentle hover micro-animation (scale) ONLY on the avatar.
// - Do NOT alter ANY course/progress/payment/navigation logic.
//
// What changed in THIS revision:
// 1) Removed `bg-white` from the thumbnail wrapper so transparent PNGs
//    don't show a forced white disc behind them. This lets your Sanity
//    uploads with transparent backgrounds look truly circular.
// 2) Added a hover micro-animation on the avatar only:
//    - Wrap the header button in `group`
//    - Apply `group-hover:scale-[1.03]` (subtle) + smooth `transition-transform`
//    - Keep `flex-none` sizing to avoid layout shifts
// 3) Left sizing from prior step: 60px (mobile) / 72px (sm+), crisp via CDN params.
//
// Everything else remains unchanged (selection, locking, completion, API).
//
// Pillars:
// - Efficiency: request only displayed pixels via Sanity CDN params.
// - Robustness: changes isolated to thumbnail wrapper + classes.
// - Simplicity: tiny, well-commented updates; no new deps.
// - Ease of mgmt: single helper + utilities; easy to tweak later.
// - Security: no data/logic changes—purely presentational.

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
 *   - fit=crop             → center crop (we then render as a circle)
 *   - auto=format          → modern formats where supported
 *
 * Note: If the URL isn't clearly a Sanity CDN URL, we return it unchanged.
 */
function sizedSanityThumb(raw: string, size: number): string {
  try {
    const url = new URL(raw);
    if (!/(\.|\/)sanity\.io\/?/.test(url.hostname + url.pathname)) return raw;

    const params = url.searchParams;
    params.set("w", String(size));
    params.set("h", String(size));
    params.set("fit", "crop");
    params.set("auto", "format");
    url.search = params.toString();
    return url.toString();
  } catch {
    return raw; // if not a valid URL, pass-through safely
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

  // Visual thumbnail sizes (unchanged from previous step):
  // - 60px on mobile
  // - 72px on small screens and up (sm:)
  //
  // We request the larger size from the CDN; Next/Image + `sizes` picks correctly.
  const THUMB_MOBILE = 60; // px
  const THUMB_SM_UP = 72;  // px

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
              className={`group w-full text-left px-4 py-3 font-semibold rounded-t-xl transition-colors flex items-center justify-between ${
                isActiveModule ? "text-blue-900 bg-blue-100" : "text-gray-800 hover:bg-gray-50"
              } ${!isUnlocked ? "cursor-not-allowed" : ""}`}
              aria-current={isActiveModule ? "true" : undefined}
              aria-disabled={!isUnlocked}
              title={!isUnlocked ? "Complete the previous module to unlock" : undefined}
            >
              {/* LEFT: Circular Thumbnail + Title */}
              <span className="flex items-center gap-3">
                {/* ✅ Circular, crisp thumbnail with subtle hover micro-animation */}
                {module.thumbnail ? (
                  <span
                    className="
                      relative w-[60px] h-[60px] sm:w-[72px] sm:h-[72px]
                      rounded-full overflow-hidden border border-blue-200
                      flex-none
                      transition-transform duration-150 ease-out
                      group-hover:scale-[1.03]
                    "
                    aria-hidden="true"
                  >
                    <Image
                      // Request the largest needed display size to avoid upscaling blur
                      src={sizedSanityThumb(module.thumbnail, THUMB_SM_UP)}
                      alt={`${module.title} thumbnail`}
                      fill
                      // Let Next/Image serve an appropriate width per viewport:
                      // - 72px on >= sm
                      // - 60px on smaller screens
                      sizes="(min-width: 640px) 72px, 60px"
                      className="object-cover"
                      quality={85}
                      loading="lazy"
                    />
                  </span>
                ) : (
                  // Circular placeholder, matching final size and theme
                  <span
                    className="
                      w-[60px] h-[60px] sm:w-[72px] sm:h-[72px]
                      rounded-full bg-gradient-to-br from-blue-100 to-blue-200
                      border border-blue-100 flex-none
                      transition-transform duration-150 ease-out
                      group-hover:scale-[1.03]
                    "
                  />
                )}

                {/* Title + Completed badge */}
                <span className="flex items-center gap-2">
                  {/* Title: subtle responsive bump */}
                  <span className="text-[15px] sm:text-base md:text-[17px] leading-tight">
                    {mIdx + 1}. {module.title}
                  </span>

                  {/* Badge scales in step with the title */}
                  {isCompleted && (
                    <span className="text-[11px] sm:text-[12px] md:text-[13px] font-medium text-emerald-700">
                      ✓ Completed
                    </span>
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
// // Purpose (surgical, UI-only):
// // - Make the module thumbnail circular and a *little* larger (still compact).
// // - Scale the "✓ Completed" badge in step with the title for visual harmony.
// // - Do NOT alter ANY course/progress/payment/navigation logic.
// //
// // What changed in THIS revision:
// // 1) Thumbnail:
// //    • Shape → circular via `rounded-full`
// //    • Size  → +small bump: 60px (mobile) → 72px (sm+)
// //    • Still sharp via Sanity CDN params (no blur, no heavy payloads)
// // 2) Title + Badge:
// //    • Title remains: 15px → 16px (sm) → 17px (md), `leading-tight`
// //    • Badge now scales in step: 11px → 12px (sm) → 13px (md)
// //
// // Everything else (selection, locking, completion, API) is unchanged.
// //
// // Pillars:
// // - Efficiency: request only the pixels we display (Sanity CDN params).
// // - Robustness: scoped to thumbnail + text spans; no cross-component impact.
// // - Simplicity: small, well-commented changes; easy to tweak later.
// // - Ease of mgmt: single helper + utility classes; no new deps.
// // - Security: no data/logic changes—purely presentational.

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
//  *   - fit=crop             → center crop (we then render as a circle)
//  *   - auto=format          → modern formats where supported
//  *
//  * Note: If the URL isn't clearly a Sanity CDN URL, we return it unchanged.
//  */
// function sizedSanityThumb(raw: string, size: number): string {
//   try {
//     const url = new URL(raw);
//     if (!/(\.|\/)sanity\.io\/?/.test(url.hostname + url.pathname)) return raw;

//     const params = url.searchParams;
//     params.set("w", String(size));
//     params.set("h", String(size));
//     params.set("fit", "crop");
//     params.set("auto", "format");
//     url.search = params.toString();
//     return url.toString();
//   } catch {
//     return raw; // if not a valid URL, pass-through safely
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

//   // Visual thumbnail sizes (slight bump from previous step):
//   // - 60px on mobile
//   // - 72px on small screens and up (sm:)
//   //
//   // We request the larger size from the CDN; Next/Image + `sizes` picks correctly.
//   const THUMB_MOBILE = 60; // px
//   const THUMB_SM_UP = 72;  // px

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
//               {/* LEFT: Circular Thumbnail + Title */}
//               <span className="flex items-center gap-3">
//                 {/* ✅ Circular, slightly larger, crisp thumbnail (with graceful fallback) */}
//                 {module.thumbnail ? (
//                   <span
//                     className="relative w-[60px] h-[60px] sm:w-[72px] sm:h-[72px] rounded-full overflow-hidden border border-blue-200 bg-white flex-none"
//                     aria-hidden="true"
//                   >
//                     <Image
//                       // Request the largest needed display size to avoid upscaling blur
//                       src={sizedSanityThumb(module.thumbnail, THUMB_SM_UP)}
//                       alt={`${module.title} thumbnail`}
//                       fill
//                       // Let Next/Image serve an appropriate width per viewport:
//                       // - 72px on >= sm
//                       // - 60px on smaller screens
//                       sizes="(min-width: 640px) 72px, 60px"
//                       className="object-cover"
//                       quality={85}
//                       loading="lazy"
//                     />
//                   </span>
//                 ) : (
//                   // Circular placeholder, matching final size and theme
//                   <span className="w-[60px] h-[60px] sm:w-[72px] sm:h-[72px] rounded-full bg-gradient-to-br from-blue-100 to-blue-200 border border-blue-100 flex-none" />
//                 )}

//                 {/* Title + Completed badge */}
//                 <span className="flex items-center gap-2">
//                   {/* Title kept subtle but clearer with responsive bump */}
//                   <span className="text-[15px] sm:text-base md:text-[17px] leading-tight">
//                     {mIdx + 1}. {module.title}
//                   </span>

//                   {/* ✅ Badge scales in step with the title for balance */}
//                   {isCompleted && (
//                     <span className="text-[11px] sm:text-[12px] md:text-[13px] font-medium text-emerald-700">
//                       ✓ Completed
//                     </span>
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











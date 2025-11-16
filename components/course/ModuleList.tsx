// components/course/ModuleList.tsx
//
// Purpose (surgical, UI-only):
// - Keep circular thumbnails, with transparent PNGs looking clean,
//   a gentle hover micro-animation, and now **sharper image quality**.
// - Do NOT alter ANY course/progress/payment/navigation logic.
//
// What changed in THIS revision:
// 1) `sizedSanityThumb` now:
//    - Requests **2× pixel density** (w/h = size * 2) for retina displays.
//    - Sets `q=90` on Sanity's CDN to improve compression quality.
//    This makes thumbnails look crisper without touching your data or logic.
// 2) All layout, sizing, hover animation, and text remain exactly
//    as in your last working version.
//
// Pillars:
// - Efficiency: still only request what we need (just higher DPI).
// - Robustness: URL helper guards non-Sanity URLs & invalid strings.
// - Simplicity: single helper change; rest of the component is untouched.
// - Ease of mgmt: clearly commented so you can tweak quality or density later.
// - Security: no data shape changes, no new external calls—purely presentational.

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
 * In THIS revision we:
 *  - Request **2× the intended display size** (retina-friendly):
 *      w = size * 2, h = size * 2
 *    so a 72px on-screen avatar gets ~144px worth of pixels.
 *  - Add `q=90` for better quality from Sanity's image pipeline.
 *
 * Appends:
 *   - w=<size * 2> & h=<size * 2>  → square, high-DPI
 *   - fit=crop                    → center crop (we then render as a circle)
 *   - auto=format                 → modern formats where supported
 *   - q=90                        → higher compression quality (sharper)
 *
 * Note: If the URL isn't clearly a Sanity CDN URL, we return it unchanged.
 */
function sizedSanityThumb(raw: string, size: number): string {
  try {
    const url = new URL(raw);

    // Only mutate clearly Sanity-hosted images; otherwise return original URL.
    if (!/(\.|\/)sanity\.io\/?/.test(url.hostname + url.pathname)) return raw;

    const params = url.searchParams;

    // ✅ Request 2× pixel density for crispness on high-DPI displays
    const effectiveSize = size * 2;
    params.set("w", String(effectiveSize));
    params.set("h", String(effectiveSize));

    // ✅ Keep square crop & automatic modern format selection
    params.set("fit", "crop");
    params.set("auto", "format");

    // ✅ Bump quality for better visual clarity
    params.set("q", "90");

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

  // Visual thumbnail sizes (unchanged from previous step):
  // - 60px on mobile
  // - 72px on small screens and up (sm:)
  //
  // We still request the larger size from the CDN; Next/Image + `sizes` pick correctly.
  // `sizedSanityThumb` now internally multiplies this by 2 for retina sharpness.
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
                      // Request the largest needed display size (helper applies 2× DPI)
                      src={sizedSanityThumb(module.thumbnail, THUMB_SM_UP)}
                      alt={`${module.title} thumbnail`}
                      fill
                      // Let Next/Image serve an appropriate width per viewport:
                      // - 72px on >= sm
                      // - 60px on smaller screens
                      sizes="(min-width: 640px) 72px, 60px"
                      className="object-cover"
                      // Keeping 85 for a good balance; main quality boost is from Sanity's `q=90` & 2× res
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
// // - Keep circular thumbnails, with transparent PNGs looking clean,
// //   a gentle hover micro-animation, and now **sharper image quality**.
// // - Do NOT alter ANY course/progress/payment/navigation logic.
// //
// // What changed in THIS revision:
// // 1) `sizedSanityThumb` now:
// //    - Requests **2× pixel density** (w/h = size * 2) for retina displays.
// //    - Sets `q=90` on Sanity's CDN to improve compression quality.
// //    This makes thumbnails look crisper without touching your data or logic.
// // 2) All layout, sizing, hover animation, and text remain exactly
// //    as in your last working version.
// //
// // Pillars:
// // - Efficiency: still only request what we need (just higher DPI).
// // - Robustness: URL helper guards non-Sanity URLs & invalid strings.
// // - Simplicity: single helper change; rest of the component is untouched.
// // - Ease of mgmt: clearly commented so you can tweak quality or density later.
// // - Security: no data shape changes, no new external calls—purely presentational.

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
//  * In THIS revision we:
//  *  - Request **2× the intended display size** (retina-friendly):
//  *      w = size * 2, h = size * 2
//  *    so a 72px on-screen avatar gets ~144px worth of pixels.
//  *  - Add `q=90` for better quality from Sanity's image pipeline.
//  *
//  * Appends:
//  *   - w=<size * 2> & h=<size * 2>  → square, high-DPI
//  *   - fit=crop                    → center crop (we then render as a circle)
//  *   - auto=format                 → modern formats where supported
//  *   - q=90                        → higher compression quality (sharper)
//  *
//  * Note: If the URL isn't clearly a Sanity CDN URL, we return it unchanged.
//  */
// function sizedSanityThumb(raw: string, size: number): string {
//   try {
//     const url = new URL(raw);

//     // Only mutate clearly Sanity-hosted images; otherwise return original URL.
//     if (!/(\.|\/)sanity\.io\/?/.test(url.hostname + url.pathname)) return raw;

//     const params = url.searchParams;

//     // ✅ Request 2× pixel density for crispness on high-DPI displays
//     const effectiveSize = size * 2;
//     params.set("w", String(effectiveSize));
//     params.set("h", String(effectiveSize));

//     // ✅ Keep square crop & automatic modern format selection
//     params.set("fit", "crop");
//     params.set("auto", "format");

//     // ✅ Bump quality for better visual clarity
//     params.set("q", "90");

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

//   // Visual thumbnail sizes (unchanged from previous step):
//   // - 60px on mobile
//   // - 72px on small screens and up (sm:)
//   //
//   // We still request the larger size from the CDN; Next/Image + `sizes` pick correctly.
//   // `sizedSanityThumb` now internally multiplies this by 2 for retina sharpness.
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
//               className={`group w-full text-left px-4 py-3 font-semibold rounded-t-xl transition-colors flex items-center justify-between ${
//                 isActiveModule ? "text-blue-900 bg-blue-100" : "text-gray-800 hover:bg-gray-50"
//               } ${!isUnlocked ? "cursor-not-allowed" : ""}`}
//               aria-current={isActiveModule ? "true" : undefined}
//               aria-disabled={!isUnlocked}
//               title={!isUnlocked ? "Complete the previous module to unlock" : undefined}
//             >
//               {/* LEFT: Circular Thumbnail + Title */}
//               <span className="flex items-center gap-3">
//                 {/* ✅ Circular, crisp thumbnail with subtle hover micro-animation */}
//                 {module.thumbnail ? (
//                   <span
//                     className="
//                       relative w-[60px] h-[60px] sm:w-[72px] sm:h-[72px]
//                       rounded-full overflow-hidden border border-blue-200
//                       flex-none
//                       transition-transform duration-150 ease-out
//                       group-hover:scale-[1.03]
//                     "
//                     aria-hidden="true"
//                   >
//                     <Image
//                       // Request the largest needed display size (helper applies 2× DPI)
//                       src={sizedSanityThumb(module.thumbnail, THUMB_SM_UP)}
//                       alt={`${module.title} thumbnail`}
//                       fill
//                       // Let Next/Image serve an appropriate width per viewport:
//                       // - 72px on >= sm
//                       // - 60px on smaller screens
//                       sizes="(min-width: 640px) 72px, 60px"
//                       className="object-cover"
//                       // Keeping 85 for a good balance; main quality boost is from Sanity's `q=90` & 2× res
//                       quality={85}
//                       loading="lazy"
//                     />
//                   </span>
//                 ) : (
//                   // Circular placeholder, matching final size and theme
//                   <span
//                     className="
//                       w-[60px] h-[60px] sm:w-[72px] sm:h-[72px]
//                       rounded-full bg-gradient-to-br from-blue-100 to-blue-200
//                       border border-blue-100 flex-none
//                       transition-transform duration-150 ease-out
//                       group-hover:scale-[1.03]
//                     "
//                   />
//                 )}

//                 {/* Title + Completed badge */}
//                 <span className="flex items-center gap-2">
//                   {/* Title: subtle responsive bump */}
//                   <span className="text-[15px] sm:text-base md:text-[17px] leading-tight">
//                     {mIdx + 1}. {module.title}
//                   </span>

//                   {/* Badge scales in step with the title */}
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
//                   Locked
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





























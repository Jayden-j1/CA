// components/course/ModuleList.tsx
//
// Purpose
// -------
// Display all course modules and lessons in a responsive sidebar.
//
// New in this patch (UX-only; no backend changes):
// 1) Locks modules until the previous module is completed.
// 2) Provides clear locked styling and prevents clicking locked lessons.
// 3) Adds `onSelectLesson(mIdx, lIdx)` so clicking a lesson displays it immediately.
//
// Props added:
// - unlockedModuleIndices: Set<number> → which module indices are unlocked.
// - onSelectLesson(mIdx, lIdx): when a lesson is clicked.
//
// Notes
// -----
// • Module 0 should always be included in unlockedModuleIndices by the caller.
// • Locked modules render with a lock icon and are not clickable.
// • This component is *purely presentational*; locking logic is driven by the page.
//
// Pillars
// -------
// - Simplicity: Tailwind only, clean prop-driven behavior.
// - Robustness: graceful fallback if lessons missing.
// - Accessibility: aria-disabled and cursor/opacity cues.
//

import React from "react";
import type { CourseModule } from "@/types/course";

interface ModuleListProps {
  modules: CourseModule[];
  currentModuleIndex: number;
  currentLessonIndex: number;
  onSelectModule: (index: number) => void;

  // NEW: which module indices are unlocked
  unlockedModuleIndices: Set<number>;

  // NEW: select a specific lesson within a module
  onSelectLesson: (moduleIndex: number, lessonIndex: number) => void;
}

const ModuleList: React.FC<ModuleListProps> = ({
  modules,
  currentModuleIndex,
  currentLessonIndex,
  onSelectModule,
  unlockedModuleIndices,
  onSelectLesson,
}) => {
  return (
    <aside
      className="bg-white/90 rounded-2xl shadow-lg p-4 sm:p-5 space-y-5 overflow-y-auto max-h-[80vh]"
      aria-label="Course modules"
    >
      {modules.map((module, mIdx) => {
        const isActiveModule = mIdx === currentModuleIndex;
        const isUnlocked = unlockedModuleIndices.has(mIdx);

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
                isActiveModule
                  ? "text-blue-900 bg-blue-100"
                  : "text-gray-800 hover:bg-gray-50"
              } ${!isUnlocked ? "cursor-not-allowed" : ""}`}
              aria-current={isActiveModule ? "true" : undefined}
              aria-disabled={!isUnlocked}
              title={!isUnlocked ? "Complete the previous module to unlock" : undefined}
            >
              <span>
                {mIdx + 1}. {module.title}
              </span>
              {!isUnlocked && (
                <span
                  className="ml-2 inline-flex items-center text-xs font-medium text-gray-600"
                  aria-hidden="true"
                >
                  🔒 Locked
                </span>
              )}
            </button>

            {/* Lesson List (only show if the module is active and unlocked) */}
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
// // Purpose
// // -------
// // Display all course modules and lessons in a responsive sidebar.
// //
// // New in this patch (UX-only):
// // - Each lesson is now an actual button and calls onSelectLesson(mIdx, lIdx)
// //   so the main pane switches to that lesson immediately.
// // - Keeps current "active" highlighting for module + lesson.
// //
// // Notes
// // -----
// // • This change is intentionally narrow: only adds a callback and makes
// //   lessons clickable. No data fetching, no auth, no payment logic.
// //
// // Pillars
// // -------
// // - Simplicity: one extra prop, minimal DOM changes.
// // - Robustness: keyboard accessible <button> for lessons.
// // - Accessibility: aria-current on active lesson.

// import React from "react";
// import type { CourseModule } from "@/types/course";

// interface ModuleListProps {
//   modules: CourseModule[];
//   currentModuleIndex: number;
//   currentLessonIndex: number;
//   onSelectModule: (index: number) => void;

//   // ✅ New: allow parent to select a specific lesson (mIdx, lIdx)
//   onSelectLesson: (moduleIndex: number, lessonIndex: number) => void;
// }

// const ModuleList: React.FC<ModuleListProps> = ({
//   modules,
//   currentModuleIndex,
//   currentLessonIndex,
//   onSelectModule,
//   onSelectLesson,
// }) => {
//   return (
//     <aside
//       className="bg-white/90 rounded-2xl shadow-lg p-4 sm:p-5 space-y-5 overflow-y-auto max-h-[80vh]"
//       aria-label="Course modules"
//     >
//       {modules.map((module, mIdx) => {
//         const isActiveModule = mIdx === currentModuleIndex;

//         return (
//           <div
//             key={module.id}
//             className={`rounded-xl transition-all border ${
//               isActiveModule
//                 ? "border-blue-500 bg-blue-50 shadow-sm"
//                 : "border-gray-200 hover:border-blue-300"
//             }`}
//           >
//             {/* Module Header */}
//             <button
//               onClick={() => onSelectModule(mIdx)}
//               className={`w-full text-left px-4 py-3 font-semibold rounded-t-xl transition-colors ${
//                 isActiveModule
//                   ? "text-blue-900 bg-blue-100"
//                   : "text-gray-800 hover:bg-gray-50"
//               }`}
//               aria-current={isActiveModule ? "true" : undefined}
//             >
//               {mIdx + 1}. {module.title}
//             </button>

//             {/* Lesson List (clickable) */}
//             {isActiveModule && (
//               <ul className="px-4 py-2 space-y-1">
//                 {(module.lessons ?? []).map((lesson, lIdx) => {
//                   const isActiveLesson =
//                     isActiveModule && lIdx === currentLessonIndex;
//                   return (
//                     <li key={lesson.id}>
//                       <button
//                         type="button"
//                         onClick={() => onSelectLesson(mIdx, lIdx)}
//                         className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-150 ${
//                           isActiveLesson
//                             ? "bg-blue-600 text-white shadow-sm scale-[1.02]"
//                             : "text-gray-700 hover:bg-blue-50 hover:text-blue-900"
//                         }`}
//                         aria-current={isActiveLesson ? "true" : undefined}
//                       >
//                         {lesson.title}
//                       </button>
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










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
// 4) ✅ NEW (optional, harmless): accepts `completedModuleIds?: string[]` to show
//    a subtle "✓ Completed" pill for modules truly completed. If parent doesn't pass
//    it, nothing changes.
//
// Props expected by design:
// - unlockedModuleIndices: Set<number> → which module indices are unlocked.
// - onSelectLesson(mIdx, lIdx): when a lesson is clicked.
// - completedModuleIds?: string[] → (optional) list of completed module IDs.
//   This is presentation-only; locking remains driven by `unlockedModuleIndices`.
//
// SAFETY GUARD (important):
// -------------------------
// To prevent `.has` on undefined, we treat `unlockedModuleIndices` as OPTIONAL
// and default it to `new Set([0])`. Module 0 is always unlocked by default.
//
// Pillars
// -------
// - Simplicity: Tailwind only, clean prop-driven behavior.
// - Robustness: graceful fallback if lessons are missing or prop omitted.
// - Accessibility: aria-disabled and cursor/opacity cues.
// - Ease of management: thoroughly commented and minimal surface area.

import React from "react";
import type { CourseModule } from "@/types/course";

interface ModuleListProps {
  modules: CourseModule[];
  currentModuleIndex: number;
  currentLessonIndex: number;

  // Select module header
  onSelectModule: (index: number) => void;

  // Which module indices are unlocked; if omitted we assume [0] for safety/back-compat
  unlockedModuleIndices?: Set<number>;

  // Select a specific lesson within a module
  onSelectLesson: (moduleIndex: number, lessonIndex: number) => void;

  // ✅ Optional list of completed module IDs for display-only badges (harmless if omitted)
  completedModuleIds?: string[];
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
  // ✅ Defensive default: if parent forgets to pass `unlockedModuleIndices`, assume module 0 unlocked.
  const safeUnlocked = unlockedModuleIndices ?? new Set<number>([0]);

  // ✅ Completed modules set (presentation-only). If not provided → empty set (no "Completed" badges).
  const completedSet = new Set<string>(Array.isArray(completedModuleIds) ? completedModuleIds : []);

  return (
    <aside
      className="bg-white/90 rounded-2xl shadow-lg p-4 sm:p-5 space-y-5 overflow-y-auto max-h-[80vh]"
      aria-label="Course modules"
    >
      {modules.map((module, mIdx) => {
        const isActiveModule = mIdx === currentModuleIndex;
        const isUnlocked = safeUnlocked.has(mIdx);
        const isCompleted = completedSet.has(module.id); // ✅ Only true if parent explicitly marks it

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
              // Only allow switching when the module is unlocked
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

              <span className="ml-2 inline-flex items-center gap-2">
                {/* Locked indicator (unchanged) */}
                {!isUnlocked && (
                  <span
                    className="inline-flex items-center text-xs font-medium text-gray-600"
                    aria-hidden="true"
                  >
                    🔒 Locked
                  </span>
                )}

                {/* ✅ Completed pill (only if parent marked it completed) */}
                {isCompleted && (
                  <span
                    className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-[11px] px-2 py-0.5 font-medium"
                    title="Module completed"
                  >
                    ✓ Completed
                  </span>
                )}
              </span>
            </button>

            {/* Lesson List
               - Only render if the module is active AND unlocked.
               - Each lesson is clickable and invokes `onSelectLesson`.
            */}
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

// components/course/ModuleList.tsx
//
// Purpose
// -------
// Display all course modules and lessons in a responsive sidebar.
//
// UX in this patch:
// 1) Modules are visually locked until prior completes (driven by unlockedModuleIndices).
// 2) Clear locked styling and prevents clicking locked lessons.
// 3) Supports clicking lessons via onSelectLesson(mIdx, lIdx).
// 4) Optional: show a small "✓ Completed" badge on modules if parent passes `completedModuleIds`.
//
// Props:
// - modules: CourseModule[]
// - currentModuleIndex: number
// - currentLessonIndex: number
// - onSelectModule(index: number): void
// - unlockedModuleIndices?: Set<number>   (defaults to Set([0]) for safety)
// - onSelectLesson(moduleIndex: number, lessonIndex: number): void
// - completedModuleIds?: string[]         (optional; for display badges only)
//
// Pillars
// -------
// - Simplicity: Tailwind only, clean prop-driven behavior.
// - Robustness: safe fallbacks; never crash if props missing.
// - Accessibility: aria-disabled and cursor/opacity cues.

"use client";

import React from "react";
import type { CourseModule } from "@/types/course";

interface ModuleListProps {
  modules: CourseModule[];
  currentModuleIndex: number;
  currentLessonIndex: number;

  onSelectModule: (index: number) => void;

  // Which module indices are unlocked; if omitted we assume [0] for safety/back-compat
  unlockedModuleIndices?: Set<number>;

  // Select a specific lesson within a module
  onSelectLesson: (moduleIndex: number, lessonIndex: number) => void;

  // Optional: used to show a "completed" badge on module headers
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
  // ✅ Defensive defaults:
  const safeUnlocked = unlockedModuleIndices ?? new Set<number>([0]);
  const completedIdSet = new Set<string>(completedModuleIds ?? []);

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
              <span className="flex items-center gap-2">
                <span>{mIdx + 1}. {module.title}</span>
                {/* Optional completed badge (purely visual) */}
                {isCompleted && (
                  <span className="text-[11px] font-medium text-emerald-700">✓ Completed</span>
                )}
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

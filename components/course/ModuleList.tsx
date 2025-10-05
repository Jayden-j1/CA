// components/course/ModuleList.tsx
//
// Purpose:
// - Left sidebar showing modules + mini lesson bullets.
// - Highlights current, marks completed, and allows quick switching.
//
// Best practices:
// - Pure presentational: receives all state via props.
// - Accessible semantics + focus ring for keyboard users.
// - Lightweight and memo-friendly.

"use client";

import React from "react";
import type { CourseModule } from "@/types/course";

interface ModuleListProps {
  modules: CourseModule[];
  currentModuleIndex: number;
  currentLessonIndex: number;
  onSelectModule: (index: number) => void;
}

const ModuleList: React.FC<ModuleListProps> = ({
  modules,
  currentModuleIndex,
  currentLessonIndex,
  onSelectModule,
}) => {
  return (
    <aside
      className="
        h-full w-full
        bg-white/85 backdrop-blur-sm
        rounded-2xl shadow-lg
        p-4 sm:p-5
        overflow-y-auto
      "
      aria-label="Modules"
    >
      <h2 className="text-lg font-bold text-blue-900 mb-3">Modules</h2>

      <ol className="space-y-3">
        {modules.map((mod, mIdx) => {
          const isActiveModule = mIdx === currentModuleIndex;
          const isCompletedModule = mIdx < currentModuleIndex;

          return (
            <li key={mod.id} className="group">
              <button
                onClick={() => onSelectModule(mIdx)}
                className={`
                  w-full text-left px-3 py-2 rounded-lg border transition
                  ${isActiveModule
                    ? "bg-blue-600 text-white border-blue-700"
                    : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"}
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                `}
                aria-current={isActiveModule ? "true" : "false"}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold truncate">{mod.title}</span>
                  {isCompletedModule && (
                    <span
                      className="ml-2 inline-flex items-center text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded"
                      title="Completed"
                    >
                      ✓
                    </span>
                  )}
                </div>

                {/* Lesson bullets */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {mod.lessons.map((lesson, lIdx) => {
                    const isActiveLesson =
                      isActiveModule && lIdx === currentLessonIndex;
                    const isCompletedLesson =
                      mIdx < currentModuleIndex ||
                      (mIdx === currentModuleIndex && lIdx < currentLessonIndex);

                    return (
                      <span
                        key={lesson.id}
                        className={`
                          inline-block w-2.5 h-2.5 rounded-full
                          ${isActiveLesson ? "bg-white ring-2 ring-white/80" :
                            isCompletedLesson ? "bg-emerald-500" : "bg-gray-300"}
                        `}
                        title={lesson.title}
                        aria-label={lesson.title}
                      />
                    );
                  })}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
};

export default ModuleList;

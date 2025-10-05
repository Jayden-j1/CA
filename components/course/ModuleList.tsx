// components/course/ModuleList.tsx
//
// Purpose
// -------
// Display all course modules and lessons in a responsive sidebar.
//
// Phase 3.2 Additions:
// - Highlights the current active module and lesson.
// - Adds soft hover + active states for clarity.
// - Keeps the design minimal and aligned with main dashboard branding.
//
// Pillars
// -------
// - Simplicity: no complex animations, just visual clarity.
// - Robustness: graceful fallback if data is missing.
// - Accessibility: proper semantic roles and keyboard-focus states.
// - Efficiency: Tailwind-only styles, no extra dependencies.
//
// ---------------------------------------------------------------------

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
      className="bg-white/90 rounded-2xl shadow-lg p-4 sm:p-5 space-y-5 overflow-y-auto max-h-[80vh]"
      aria-label="Course modules"
    >
      {modules.map((module, mIdx) => {
        const isActiveModule = mIdx === currentModuleIndex;

        return (
          <div
            key={module.id}
            className={`rounded-xl transition-all border ${
              isActiveModule
                ? "border-blue-500 bg-blue-50 shadow-sm"
                : "border-gray-200 hover:border-blue-300"
            }`}
          >
            {/* Module Header */}
            <button
              onClick={() => onSelectModule(mIdx)}
              className={`w-full text-left px-4 py-3 font-semibold rounded-t-xl transition-colors ${
                isActiveModule
                  ? "text-blue-900 bg-blue-100"
                  : "text-gray-800 hover:bg-gray-50"
              }`}
              aria-current={isActiveModule ? "true" : undefined}
            >
              {mIdx + 1}. {module.title}
            </button>

            {/* Lesson List */}
            {isActiveModule && (
              <ul className="px-4 py-2 space-y-1">
                {(module.lessons ?? []).map((lesson, lIdx) => {
                  const isActiveLesson =
                    isActiveModule && lIdx === currentLessonIndex;
                  return (
                    <li
                      key={lesson.id}
                      className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-all duration-150 ${
                        isActiveLesson
                          ? "bg-blue-600 text-white shadow-sm scale-[1.02]"
                          : "text-gray-700 hover:bg-blue-50 hover:text-blue-900"
                      }`}
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

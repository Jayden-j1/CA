// app/components/course/ProgressBar.tsx
//
// Purpose
// -------
// Simple, accessible progress bar that reads the authenticated user's
// progress for a given `courseId` and renders a modern bar.
// It automatically updates when the page emits "course-progress-updated".
//
// Drop-in usage
// -------------
// <ProgressBar courseId={course.id} className="mb-4" />

"use client";

import { useCourseProgress } from "@/app/hooks/useCourseProgress";
import clsx from "clsx";

export default function ProgressBar({
  courseId,
  className,
  label = "Course progress",
}: {
  courseId: string | undefined;
  className?: string;
  label?: string;
}) {
  const { percent, loading, error } = useCourseProgress(courseId);

  // Basic skeleton UI while loading (kept minimal)
  if (loading) {
    return (
      <div className={clsx("w-full", className)}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-700">{label}</span>
          <span className="text-sm text-gray-500">—</span>
        </div>
        <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden">
          <div className="h-full w-1/3 animate-pulse bg-gray-300" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={clsx("w-full", className)}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-700">{label}</span>
          <span className="text-sm text-red-600">Error</span>
        </div>
        <div className="w-full h-3 rounded-full bg-red-100 overflow-hidden">
          <div className="h-full w-1/3 bg-red-300" />
        </div>
        <p className="mt-1 text-xs text-red-600">{error}</p>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className={clsx("w-full", className)} aria-live="polite">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="text-sm text-gray-700">{pct}%</span>
      </div>

      {/* Accessible progressbar */}
      <div
        className="w-full h-3 rounded-full bg-gray-200 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={label}
      >
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

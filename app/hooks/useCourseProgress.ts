// app/hooks/useCourseProgress.ts
//
// Purpose
// -------
// Lightweight client hook to read a user's course progress from the server,
// expose `percent` + `completedModuleIds`, and keep it refreshed whenever
// the page emits a "course-progress-updated" event (after saves).
//
// No external deps (no SWR). Minimal fetch with abort + event listener.
// Does not alter any other flows.
//
// Usage
// -----
// const { percent, completedModuleIds, loading, error, refresh } = useCourseProgress(courseId);

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ApiShape = {
  completedModuleIds: string[];
  percent: number | null;
  lastModuleId?: string | null;
  meta?: {
    completedModuleIds: string[];
    lastModuleId: string | null;
    percent: number | null;
  };
};

export function useCourseProgress(courseId: string | undefined) {
  const [percent, setPercent] = useState<number>(0);
  const [completedModuleIds, setCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(!!courseId);
  const [error, setError] = useState<string>("");

  const ctrlRef = useRef<AbortController | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError("");
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    try {
      // You may keep the singular path. If some parts still call plural, both work if you kept that route.
      const res = await fetch(`/api/course/progress?courseId=${encodeURIComponent(courseId)}`, {
        cache: "no-store",
        signal: ctrl.signal,
      });
      const json: ApiShape = await res.json();
      if (!res.ok) throw new Error((json as any)?.error || `HTTP ${res.status}`);

      // Prefer top-level `percent` if present; otherwise fall back to meta.
      const p =
        typeof json.percent === "number"
          ? json.percent
          : typeof json.meta?.percent === "number"
          ? json.meta.percent
          : 0;

      setPercent(Math.max(0, Math.min(100, Math.round(p))));
      setCompleted(Array.isArray(json.completedModuleIds) ? json.completedModuleIds : []);
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message || "Failed to fetch progress");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [courseId]);

  // Initial + course change load
  useEffect(() => {
    void fetchProgress();
    return () => {
      ctrlRef.current?.abort();
    };
  }, [fetchProgress]);

  // Live refresh when any part of the app broadcasts "course-progress-updated"
  useEffect(() => {
    if (!courseId) return;

    const onBump = (evt: Event) => {
      try {
        const detail = (evt as CustomEvent)?.detail as { courseId?: string; percent?: number };
        if (!detail || (detail.courseId && detail.courseId !== courseId)) return;
        // Quick optimistic update (if percent provided), then refresh server truth.
        if (typeof detail.percent === "number") {
          setPercent(Math.max(0, Math.min(100, Math.round(detail.percent))));
        }
        void fetchProgress();
      } catch {
        // ignore parse mishaps
      }
    };

    window.addEventListener("course-progress-updated" as any, onBump);
    return () => window.removeEventListener("course-progress-updated" as any, onBump);
  }, [courseId, fetchProgress]);

  return { percent, completedModuleIds, loading, error, refresh: fetchProgress };
}

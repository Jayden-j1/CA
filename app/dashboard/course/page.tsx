// app/dashboard/course/page.tsx
//
// Finalised course flow (surgical + robust on Vercel)
// ---------------------------------------------------
// ✅ Module 1 unlocked by default; others remain locked until prior module completes.
// ✅ “Module completed” only appears for modules actually completed.
// ✅ After completing a quiz: Submit → brief “Submitting…” → auto-advance to next lesson/module → smooth scroll to top.
// ✅ After completing a no-quiz module: click “Mark module complete” → auto-advance → smooth scroll.
// ✅ Does NOT rely on stale closure values for locks during auto-advance (prevents Vercel “stuck”).
// ✅ No changes to auth, signup, staff, payment, or unrelated flows.
//
// How we ensure robustness:
// - When a module is marked complete, we optimistically update local state immediately.
// - For auto-advance, we DO NOT check `unlockedModuleIndices` inside the timer (it can be stale).
//   Completing the current module *definitionally* unlocks the next module, so we proceed safely.
// - Progress POST is fire-and-forget; UI never blocks on network.
//
// Pillars: efficiency, robustness, simplicity, security, ease of management.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePaidAccess } from "@/hooks/usePaidAccess";

import ModuleList from "@/components/course/ModuleList";
import PortableTextRenderer from "@/components/course/PortableTextRenderer";
import QuizCard from "@/components/course/QuizCard";
import VideoPlayer from "@/components/course/VideoPlayer";

import type {
  CourseModule as UICourseModule,
  CourseLesson as UICourseLesson,
  CourseQuiz as UICourseQuiz,
} from "@/types/course";

// ---------------- DTOs ----------------
interface CourseDTO {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverImage: string | null;
  modules: CourseModuleDTO[];
}
interface CourseModuleDTO {
  id: string;
  title: string;
  description?: string;
  lessons: CourseLessonDTO[];
}
interface CourseLessonDTO {
  id: string;
  title: string;
  videoUrl?: string;
  body?: any;
  quiz?: CourseQuizDTO;
}
interface CourseQuizDTO {
  passingScore?: number;
  questions: {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
  }[];
}
type QuizAnswers = Record<string, number | null>;

// ---------------- Helpers ----------------

/** Linearize lessons to compute previous/next navigation pairs. */
function computeAdjacentLesson(
  modules: UICourseModule[],
  moduleIndex: number,
  lessonIndex: number
) {
  const pairs: Array<{ m: number; l: number }> = [];
  modules.forEach((m, mIdx) => {
    (m.lessons ?? []).forEach((_l, lIdx) => pairs.push({ m: mIdx, l: lIdx }));
  });

  const currentFlatIdx = pairs.findIndex((p) => p.m === moduleIndex && p.l === lessonIndex);
  const prev = currentFlatIdx > 0 ? pairs[currentFlatIdx - 1] : null;
  const next =
    currentFlatIdx >= 0 && currentFlatIdx < pairs.length - 1 ? pairs[currentFlatIdx + 1] : null;

  return { prev, next };
}

/** Normalize API DTO → UI types (keeps your Video/Body/Quiz components unchanged). */
function normalizeModules(dtoModules: CourseModuleDTO[] | undefined): UICourseModule[] {
  if (!Array.isArray(dtoModules)) return [];
  return dtoModules.map<UICourseModule>((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    lessons: (m.lessons ?? []).map<UICourseLesson>((l) => ({
      id: l.id,
      title: l.title,
      videoUrl: l.videoUrl ?? "",
      body: l.body,
      quiz: l.quiz
        ? (({
            questions:
              l.quiz.questions?.map((q) => ({
                id: q.id,
                question: q.question,
                options: q.options,
                correctIndex: q.correctIndex,
              })) ?? [],
            passingScore: l.quiz.passingScore,
          } as any) as UICourseQuiz)
        : undefined,
    })),
  }));
}

/** LocalStorage keys (fallback + resume). */
const progressKey = (courseId: string) => `courseProgress:${courseId}`;
const resumeKey = (courseId: string) => `courseResume:${courseId}`;

/** Load optimistic local progress. */
function loadLocalProgress(courseId: string): { completedModuleIds: string[] } {
  try {
    const raw = localStorage.getItem(progressKey(courseId));
    if (!raw) return { completedModuleIds: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.completedModuleIds)) return { completedModuleIds: [] };
    return { completedModuleIds: parsed.completedModuleIds as string[] };
  } catch {
    return { completedModuleIds: [] };
  }
}

/** Save optimistic local progress. */
function saveLocalProgress(courseId: string, completedModuleIds: string[]) {
  try {
    localStorage.setItem(progressKey(courseId), JSON.stringify({ completedModuleIds }));
  } catch {}
}

/** Save a tiny resume pointer to local storage (moduleId + lessonId). */
function saveResume(courseId: string, moduleId: string, lessonId: string) {
  try {
    localStorage.setItem(resumeKey(courseId), JSON.stringify({ moduleId, lessonId }));
  } catch {}
}

/** Load resume pointer from local storage. */
function loadResume(courseId: string): { moduleId?: string; lessonId?: string } {
  try {
    const raw = localStorage.getItem(resumeKey(courseId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      moduleId: typeof parsed?.moduleId === "string" ? parsed.moduleId : undefined,
      lessonId: typeof parsed?.lessonId === "string" ? parsed.lessonId : undefined,
    };
  } catch {
    return {};
  }
}

/** True if the lesson is the last lesson within its module. */
function isOnModuleLastLesson(
  modules: UICourseModule[],
  moduleIndex: number,
  lessonIndex: number
): boolean {
  const m = modules[moduleIndex];
  if (!m || !Array.isArray(m.lessons) || m.lessons.length === 0) return false;
  return lessonIndex === m.lessons.length - 1;
}

/**
 * Compute which module indices should be unlocked.
 * Rules (sequential locking):
 *  - Always unlock module index 0
 *  - Unlock every module that is already completed
 *  - Also unlock the module immediately after the *highest* completed index
 */
function computeUnlocked(
  modules: UICourseModule[],
  completedModuleIds: Set<string>
): Set<number> {
  const unlocked = new Set<number>();
  if (modules.length === 0) return unlocked;

  unlocked.add(0); // Module 1 unlocked by default

  let farthest = -1;
  modules.forEach((m, idx) => {
    if (completedModuleIds.has(m.id)) {
      unlocked.add(idx);
      farthest = Math.max(farthest, idx);
    }
  });

  const nextIdx = farthest + 1;
  if (nextIdx >= 0 && nextIdx < modules.length) unlocked.add(nextIdx);

  return unlocked;
}

/** Compute % complete client-side as a safe fallback. */
function computePercentClient(totalModules: number, completedCount: number): number {
  if (totalModules <= 0) return 0;
  const pct = Math.round((completedCount / totalModules) * 100);
  return Math.max(0, Math.min(100, pct));
}

/** Smooth scroll helper for UX polish when changing modules. */
function scrollToTopSmooth() {
  try {
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch {}
}

/** 🔔 Broadcast a tiny event so any progress bar hook can refresh immediately. */
function dispatchProgressEvent(courseId: string, percent: number) {
  try {
    window.dispatchEvent(
      new CustomEvent("course-progress-updated", { detail: { courseId, percent } })
    );
  } catch {}
}

// =============================================================================

export default function CoursePage() {
  const router = useRouter();
  const access = usePaidAccess();

  // Access check — unchanged (keep hooks above all conditional returns)
  useEffect(() => {
    if (access.loading) return;
    if (!access.hasAccess) {
      router.replace("/dashboard/upgrade");
    }
  }, [access.loading, access.hasAccess, router]);

  // Canonical slug param
  const searchParams = useSearchParams();
  const slug = (searchParams?.get("slug") || "cultural-awareness-training").trim();

  // Course load state
  const [course, setCourse] = useState<CourseDTO | null>(null);
  const [loadingCourse, setLoadingCourse] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>("");

  // Fetch course (server source of truth)
  useEffect(() => {
    if (access.loading || !access.hasAccess) return;

    let cancelled = false;
    const run = async () => {
      setLoadingCourse(true);
      setLoadError("");
      try {
        const res = await fetch(`/api/courses/${encodeURIComponent(slug)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load course");
        if (!cancelled) setCourse(data.course as CourseDTO);
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || "Unable to load course");
      } finally {
        if (!cancelled) setLoadingCourse(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [access.loading, access.hasAccess, slug]);

  // Normalize modules for UI
  const uiModules: UICourseModule[] = useMemo(
    () => normalizeModules(course?.modules),
    [course?.modules]
  );
  const totalModules = uiModules.length;

  // Current indices
  const [currentModuleIndex, setCurrentModuleIndex] = useState<number>(0);
  const [currentLessonIndex, setCurrentLessonIndex] = useState<number>(0);

  // Reset to first lesson when module changes
  useEffect(() => {
    setCurrentLessonIndex(0);
  }, [currentModuleIndex]);

  // Current module/lesson derived
  const currentModule = useMemo(() => {
    if (!uiModules.length) return null;
    return uiModules[currentModuleIndex] || uiModules[0] || null;
  }, [uiModules, currentModuleIndex]);

  const currentLesson = useMemo(() => {
    if (!currentModule?.lessons?.length) return null;
    return currentModule.lessons[currentLessonIndex] || currentModule.lessons[0] || null;
  }, [currentModule, currentLessonIndex]);

  const { prev: prevLesson, next: nextLesson } = useMemo(() => {
    return computeAdjacentLesson(uiModules, currentModuleIndex, currentLessonIndex);
  }, [uiModules, currentModuleIndex, currentLessonIndex]);

  // Quiz UI state
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [revealed, setRevealed] = useState<boolean>(false);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear quiz state on lesson change + save resume pointer
  useEffect(() => {
    setAnswers({});
    setRevealed(false);
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }

    if (course?.id && currentModule && currentLesson) {
      saveResume(course.id, currentModule.id, currentLesson.id);
    }
  }, [currentLesson?.id, currentModule?.id, course?.id]);

  // ---------------- SERVER PROGRESS: completion state + unlocks ----------------

  const [completedModuleIds, setCompletedModuleIds] = useState<Set<string>>(new Set());
  const [seededFromServer, setSeededFromServer] = useState<boolean>(false);

  // Seed from local (optimistic), then hydrate from server (prefer server meta only if present).
  useEffect(() => {
    if (!course?.id) return;

    // 1) Local optimistic seed
    const local = loadLocalProgress(course.id);
    const localSet = new Set(local.completedModuleIds);
    setCompletedModuleIds(localSet);

    // 2) Server seed
    (async () => {
      try {
        const res = await fetch(
          `/api/course/progress?courseId=${encodeURIComponent(course.id)}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => ({}));

        if (json?.meta) {
          const serverArr: string[] = Array.isArray(json.meta.completedModuleIds)
            ? json.meta.completedModuleIds.filter((s: unknown) => typeof s === "string")
            : [];
          const serverSet = new Set(serverArr);

          setCompletedModuleIds(serverSet);
          saveLocalProgress(course.id, Array.from(serverSet));

          // Attempt to restore position from server lastModuleId else local resume
          const lastModuleId: string | null =
            typeof json.meta.lastModuleId === "string" ? json.meta.lastModuleId : null;

          if (lastModuleId && uiModules.length) {
            const mIdx = uiModules.findIndex((m) => m.id === lastModuleId);
            if (mIdx >= 0) {
              setCurrentModuleIndex(mIdx);
              setCurrentLessonIndex(0);
            }
          } else {
            const { moduleId, lessonId } = loadResume(course.id);
            if (moduleId) {
              const mIdx = uiModules.findIndex((m) => m.id === moduleId);
              if (mIdx >= 0) {
                setCurrentModuleIndex(mIdx);
                if (lessonId && uiModules[mIdx]?.lessons?.length) {
                  const lIdx = uiModules[mIdx].lessons.findIndex((l) => l.id === lessonId);
                  if (lIdx >= 0) setCurrentLessonIndex(lIdx);
                }
              }
            }
          }
        }
      } catch {
        // Network/server failure → keep local as-is
      } finally {
        setSeededFromServer(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id, uiModules.length]);

  // Compute unlocked indices based on completion
  const unlockedModuleIndices: Set<number> = useMemo(() => {
    return computeUnlocked(uiModules, completedModuleIds);
  }, [uiModules, completedModuleIds]);

  /** Persist a snapshot to the server (fire-and-forget; don't block UI). */
  function saveProgressSnapshot(opts?: { lastModuleId?: string | null }) {
    if (!course?.id) return;

    const completedArr = Array.from(completedModuleIds);
    const percent = computePercentClient(totalModules, completedArr.length);

    const body = {
      courseId: course.id,
      completedModuleIds: completedArr,
      lastModuleId: typeof opts?.lastModuleId === "string" ? opts.lastModuleId : null,
      percent, // explicit so GET has a top-level percent immediately after
    };

    fetch("/api/course/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
      .then((res) => {
        if (res.ok) {
          // Notify any progress bars/hooks to refresh (they can re-fetch GET /progress)
          dispatchProgressEvent(course.id!, percent);
        }
      })
      .catch(() => {
        // Swallow; local optimistic state remains and a later action can retry.
      });
  }

  /**
   * Idempotently mark the *current* module complete and persist in background.
   * Returns true if we transitioned state (used to drive auto-advance).
   */
  function markCurrentModuleComplete(): boolean {
    if (!currentModule || !course?.id) return false;

    const id = currentModule.id;
    if (completedModuleIds.has(id)) return false; // already complete

    const next = new Set(completedModuleIds);
    next.add(id);
    setCompletedModuleIds(next);
    saveLocalProgress(course.id, Array.from(next));

    // Persist in background (non-blocking)
    saveProgressSnapshot({ lastModuleId: id });

    return true;
  }

  // ---------------- Handlers ----------------

  const handleQuizChange = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleQuizSubmit = () => {
    // 1) Reveal feedback UI inside <QuizCard/> (button shows “Submitting…” via revealed)
    setRevealed(true);

    // 2) Complete the module synchronously (optimistic), persist in background
    const changed = markCurrentModuleComplete();

    // 3) Auto-advance shortly (regardless of unlocked memo), with smooth scroll on module change
    if (changed) {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = setTimeout(() => {
        const { next } = computeAdjacentLesson(uiModules, currentModuleIndex, currentLessonIndex);
        if (!next) return; // nothing to advance to (end of course)

        const crossingModule = next.m !== currentModuleIndex;
        // We no longer block on `unlockedModuleIndices` here — completing current module unlocks next by definition.
        setCurrentModuleIndex(next.m);
        setCurrentLessonIndex(next.l);
        if (crossingModule) scrollToTopSmooth();
      }, 600);
    }

    return true as any; // returns quickly so QuizCard clears button state soon after
  };

  const goPrev = () => {
    if (!prevLesson) return;
    const crossingModule = prevLesson.m !== currentModuleIndex;
    setCurrentModuleIndex(prevLesson.m);
    setCurrentLessonIndex(prevLesson.l);
    if (crossingModule) scrollToTopSmooth();
  };

  const nextWouldEnterLockedModule =
    !!nextLesson &&
    nextLesson.m !== currentModuleIndex &&
    !unlockedModuleIndices.has(nextLesson.m);

  const goNext = () => {
    if (!nextLesson) return;
    const crossingModule = nextLesson.m !== currentModuleIndex;

    // Manual Next is still guarded by locks (prevents skipping ahead).
    if (nextWouldEnterLockedModule) {
      console.warn("Blocked: Next would enter a locked module. Complete current module first.");
      return;
    }

    setCurrentModuleIndex(nextLesson.m);
    setCurrentLessonIndex(nextLesson.l);
    if (crossingModule) scrollToTopSmooth();
  };

  const handleSelectLesson = (mIdx: number, lIdx: number) => {
    // Respect locking — ignore clicks on locked modules/lessons
    if (!unlockedModuleIndices.has(mIdx)) return;
    const crossingModule = mIdx !== currentModuleIndex;
    setCurrentModuleIndex(mIdx);
    setCurrentLessonIndex(lIdx);
    if (crossingModule) scrollToTopSmooth();
  };

  // ---------------- Render states (unchanged) ----------------

  if (access.loading) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Checking access…</p>
      </section>
    );
  }
  if (!access.hasAccess) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Redirecting…</p>
      </section>
    );
  }
  if (loadingCourse) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Loading course…</p>
      </section>
    );
  }
  if (loadError || !course) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300 px-6 text-center">
        <div className="bg-white/90 rounded-xl shadow p-6 max-w-lg">
          <h2 className="text-xl font-bold text-red-700 mb-2">Unable to load course</h2>
          <p className="text-gray-700">{loadError || "Unknown error."}</p>
        </div>
      </section>
    );
  }

  const onLastLessonNoQuiz =
    !!currentModule &&
    isOnModuleLastLesson(uiModules, currentModuleIndex, currentLessonIndex) &&
    !currentLesson?.quiz;

  const isCurrentModuleCompleted =
    !!currentModule && completedModuleIds.has(currentModule.id);

  // Tiny derived values without hooks (avoid changing hook order).
  const completedIdsArray = Array.from(completedModuleIds);

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-10 px-4 sm:px-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6 text-white">
        <h1 className="text-3xl font-bold">{course.title}</h1>
        {course.summary && <p className="opacity-90 mt-1">{course.summary}</p>}
        {/* Your progress ring/component can listen to 'course-progress-updated' to refresh instantly. */}
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar (Modules) */}
        <div className="lg:col-span-4">
          <ModuleList
            modules={uiModules}
            currentModuleIndex={currentModuleIndex}
            currentLessonIndex={currentLessonIndex}
            onSelectModule={(idx) => {
              if (!unlockedModuleIndices.has(idx)) return;
              const crossingModule = idx !== currentModuleIndex;
              setCurrentModuleIndex(idx);
              setCurrentLessonIndex(0);
              if (crossingModule) scrollToTopSmooth();
            }}
            // Locking UI/behavior
            unlockedModuleIndices={unlockedModuleIndices}
            onSelectLesson={handleSelectLesson}
            // Optional: used only for display badges inside ModuleList
            completedModuleIds={completedIdsArray}
          />
        </div>

        {/* Main content */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl shadow-lg p-5 space-y-5">
            {/* Lesson Title + Controls */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-blue-900">
                  {currentLesson?.title || "Lesson"}
                </h2>
                {currentModule?.title && (
                  <p className="text-sm text-gray-500">In module: {currentModule.title}</p>
                )}
                {isCurrentModuleCompleted && (
                  <p className="text-xs text-emerald-700 mt-1 font-medium">Module completed</p>
                )}
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="flex gap-2">
                  <button
                    disabled={!prevLesson}
                    className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50 hover:bg-gray-50"
                    onClick={goPrev}
                  >
                    ← Prev
                  </button>
                  <button
                    disabled={!nextLesson || nextWouldEnterLockedModule}
                    className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50 hover:bg-gray-50"
                    onClick={goNext}
                    aria-disabled={!nextLesson || nextWouldEnterLockedModule}
                    aria-label={
                      nextWouldEnterLockedModule
                        ? "Next lesson is in a locked module. Complete current module first."
                        : "Go to next lesson"
                    }
                  >
                    Next →
                  </button>
                </div>
                {nextWouldEnterLockedModule && (
                  <p className="text-[11px] text-amber-700">
                    Complete this module to unlock the next one.
                  </p>
                )}
              </div>
            </div>

            {/* Video (optional) */}
            {currentLesson?.videoUrl && (
              <VideoPlayer src={currentLesson.videoUrl} title={currentLesson.title} />
            )}

            {/* Rich body */}
            {Array.isArray(currentLesson?.body) ? (
              <PortableTextRenderer value={currentLesson?.body} className="prose prose-blue max-w-none" />
            ) : currentLesson?.body ? (
              <div className="prose max-w-none">
                <p>{String(currentLesson.body)}</p>
              </div>
            ) : null}

            {/* Quiz (optional; reveal-only — no score displayed) */}
            {!!currentLesson?.quiz && (
              <div className="mt-4">
                <QuizCard
                  quiz={currentLesson.quiz}
                  answers={answers}
                  revealed={revealed}
                  onChange={handleQuizChange}
                  onSubmit={handleQuizSubmit}
                />
              </div>
            )}

            {/* Manual completion for modules WITHOUT quiz, only on the final lesson */}
            {onLastLessonNoQuiz && !isCurrentModuleCompleted && (
              <div className="pt-2">
                <button
                  onClick={() => {
                    const changed = markCurrentModuleComplete();
                    if (changed) {
                      const { next } = computeAdjacentLesson(
                        uiModules,
                        currentModuleIndex,
                        currentLessonIndex
                      );
                      if (next) {
                        const crossingModule = next.m !== currentModuleIndex;
                        setCurrentModuleIndex(next.m);
                        setCurrentLessonIndex(next.l);
                        if (crossingModule) scrollToTopSmooth();
                      }
                    }
                  }}
                  className="inline-flex items-center justify-center px-5 py-2 rounded-lg font-semibold
                             bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-transform hover:scale-[1.02]"
                >
                  Mark module complete
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  This module has no quiz. Click to confirm you’ve completed it and unlock the next module.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

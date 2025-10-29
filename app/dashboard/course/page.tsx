// app/dashboard/course/page.tsx
//
// Surgical changes in this revision:
//  • Broadcast a tiny "course-progress-updated" CustomEvent *after* successful POST,
//    carrying { courseId, percent } so any progress bars/hooks can refresh immediately.
//  • Keep smooth scroll to top when crossing into a new module (already present).
//  • Do not modify auth, signup, staff, payment, Sanity content, or other flows.
//
// Notes:
//  - This file alone doesn't *render* a progress bar. It only guarantees that whenever
//    progress is saved, any client UI listening for "course-progress-updated" can update
//    instantly (e.g., a header progress bar using a hook).
//  - Percent is computed client-side (safe fallback) and also persisted server-side.

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

/** Compute previous/next lesson across *all* modules linearly. */
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

/** Normalize API DTO → UI types (keeps downstream components unchanged). */
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

/** Local storage keys for optimistic progress + resume. */
const progressKey = (courseId: string) => `courseProgress:${courseId}`;
const resumeKey = (courseId: string) => `courseResume:${courseId}`;

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
function saveLocalProgress(courseId: string, completedModuleIds: string[]) {
  try {
    localStorage.setItem(progressKey(courseId), JSON.stringify({ completedModuleIds }));
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}
function saveResume(courseId: string, moduleId: string, lessonId: string) {
  try {
    localStorage.setItem(resumeKey(courseId), JSON.stringify({ moduleId, lessonId }));
  } catch {
    // ignore
  }
}
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

/** True if current lesson is last within its module. */
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
 * Sequential locking:
 *  - Always unlock module index 0
 *  - Unlock completed modules
 *  - Unlock the module immediately after the highest completed index
 */
function computeUnlocked(
  modules: UICourseModule[],
  completedModuleIds: Set<string>
): Set<number> {
  const unlocked = new Set<number>();
  if (modules.length === 0) return unlocked;

  unlocked.add(0);

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

/** Safe client-side percent (fallback; server also stores a percent). */
function computePercentClient(totalModules: number, completedCount: number): number {
  if (totalModules <= 0) return 0;
  const pct = Math.round((completedCount / totalModules) * 100);
  return Math.max(0, Math.min(100, pct));
}

/** Smooth scroll helper for UX polish when changing modules. */
function scrollToTopSmooth() {
  try {
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch {
    // ignore SSR/window issues
  }
}

/**
 * 🔔 Broadcast a tiny event after we persist progress so any UI
 * (e.g., a progress bar hook) can refresh immediately.
 * We keep the payload minimal and generic: { courseId, percent }.
 */
function dispatchProgressEvent(courseId: string, percent: number) {
  try {
    window.dispatchEvent(
      new CustomEvent("course-progress-updated", { detail: { courseId, percent } })
    );
  } catch {
    // ignore if CustomEvent unsupported
  }
}

// =============================================================================

export default function CoursePage() {
  const router = useRouter();
  const access = usePaidAccess();

  // Access check — unchanged
  useEffect(() => {
    if (access.loading) return;
    if (!access.hasAccess) {
      router.replace("/dashboard/upgrade");
    }
  }, [access.loading, access.hasAccess, router]);

  // Canonical slug param
  const searchParams = useSearchParams();
  const slug = (searchParams?.get("slug") || "cultural-awareness-training").trim();

  // Course load state (server source of truth for content)
  const [course, setCourse] = useState<CourseDTO | null>(null);
  const [loadingCourse, setLoadingCourse] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>("");

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

  // Reset lesson index when module changes
  useEffect(() => {
    setCurrentLessonIndex(0);
  }, [currentModuleIndex]);

  // Current derived refs
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

  // Reset quiz state on lesson change + persist resume pointer
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

  // -------- server progress + unlocks --------

  const [completedModuleIds, setCompletedModuleIds] = useState<Set<string>>(new Set());
  const [seededFromServer, setSeededFromServer] = useState<boolean>(false);

  // Seed optimistic local, then hydrate from server (if available)
  useEffect(() => {
    if (!course?.id) return;

    const local = loadLocalProgress(course.id);
    const localSet = new Set(local.completedModuleIds);
    setCompletedModuleIds(localSet);

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

          // Try restoring from server-side lastModuleId first; else local resume
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
        // Network/server failure → keep local fallback
      } finally {
        setSeededFromServer(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id, uiModules.length]);

  // Compute unlocked modules based on completion
  const unlockedModuleIndices: Set<number> = useMemo(() => {
    return computeUnlocked(uiModules, completedModuleIds);
  }, [uiModules, completedModuleIds]);

  /**
   * Persist a snapshot to the server.
   * We also broadcast a client event after success so progress bars refresh immediately.
   */
  async function saveProgressSnapshot(opts?: { lastModuleId?: string | null }) {
    if (!course?.id) return;

    const completedArr = Array.from(completedModuleIds);
    const percent = computePercentClient(totalModules, completedArr.length);

    const body = {
      courseId: course.id,
      completedModuleIds: completedArr,
      lastModuleId: typeof opts?.lastModuleId === "string" ? opts.lastModuleId : null,
      percent, // Explicit to ensure server mirrors the same value; GET returns top-level percent.
    };

    try {
      const res = await fetch("/api/course/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      // 🔔 If persisted, notify any listeners (e.g., a header progress bar) to refresh immediately.
      if (res.ok) {
        dispatchProgressEvent(course.id, percent);
      }
    } catch {
      // Swallow errors; local optimistic state remains and future actions can retry.
    }
  }

  /** Idempotently mark the *current* module complete, save to server, and unlock next. */
  async function markCurrentModuleComplete(): Promise<boolean> {
    if (!currentModule || !course?.id) return false;
    const id = currentModule.id;
    if (completedModuleIds.has(id)) return false;

    const next = new Set(completedModuleIds);
    next.add(id);
    setCompletedModuleIds(next);
    saveLocalProgress(course.id, Array.from(next));
    await saveProgressSnapshot({ lastModuleId: id });
    return true;
  }

  // -------- handlers --------

  const handleQuizChange = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleQuizSubmit = async () => {
    // 1) Reveal green/red feedback (handled inside <QuizCard/>)
    setRevealed(true);

    // 2) Complete the module and persist progress
    await markCurrentModuleComplete();

    // 3) Auto-advance shortly (UX: give a moment to see reveal), respecting locks
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = setTimeout(() => {
      const { next } = computeAdjacentLesson(uiModules, currentModuleIndex, currentLessonIndex);
      if (!next) return;

      const crossingModule = next.m !== currentModuleIndex;
      if (crossingModule && !unlockedModuleIndices.has(next.m)) return;

      setCurrentModuleIndex(next.m);
      setCurrentLessonIndex(next.l);
      if (crossingModule) scrollToTopSmooth();
    }, 600);

    return true;
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

    // Hard block if "next" would enter a locked module.
    if (nextWouldEnterLockedModule) {
      console.warn("Blocked: Next would enter a locked module. Complete current module first.");
      return;
    }

    setCurrentModuleIndex(nextLesson.m);
    setCurrentLessonIndex(nextLesson.l);
    if (crossingModule) scrollToTopSmooth();
  };

  const handleSelectLesson = (mIdx: number, lIdx: number) => {
    if (!unlockedModuleIndices.has(mIdx)) return;
    const crossingModule = mIdx !== currentModuleIndex;
    setCurrentModuleIndex(mIdx);
    setCurrentLessonIndex(lIdx);
    if (crossingModule) scrollToTopSmooth();
  };

  // -------- render states (unchanged) --------

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

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-10 px-4 sm:px-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6 text-white">
        <h1 className="text-3xl font-bold">{course.title}</h1>
        {course.summary && <p className="opacity-90 mt-1">{course.summary}</p>}
        {/* If you already have a ProgressBar component elsewhere, it will now
            receive 'course-progress-updated' events immediately after POST. */}
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
            unlockedModuleIndices={unlockedModuleIndices}
            onSelectLesson={handleSelectLesson}
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

            {/* Quiz (optional; reveal-only) */}
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
                  onClick={async () => {
                    await markCurrentModuleComplete();
                    const { next } = computeAdjacentLesson(uiModules, currentModuleIndex, currentLessonIndex);
                    if (next && (next.m === currentModuleIndex || unlockedModuleIndices.has(next.m))) {
                      const crossingModule = next.m !== currentModuleIndex;
                      setCurrentModuleIndex(next.m);
                      setCurrentLessonIndex(next.l);
                      if (crossingModule) scrollToTopSmooth();
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










// // app/dashboard/course/page.tsx
// //
// // Changes in this revision (surgical):
// //  • [SCROLL TOP ✅] Smoothly scroll to page top whenever navigation crosses into a new module.
// //  • Progress persistence unchanged here; API now guarantees top-level `percent` on GET/POST.
// //
// // No changes to auth, signup, staff, payment, or unrelated UI.

// "use client";

// import { useEffect, useMemo, useRef, useState } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { usePaidAccess } from "@/hooks/usePaidAccess";

// import ModuleList from "@/components/course/ModuleList";
// import PortableTextRenderer from "@/components/course/PortableTextRenderer";
// import QuizCard from "@/components/course/QuizCard";
// import VideoPlayer from "@/components/course/VideoPlayer";

// import type {
//   CourseModule as UICourseModule,
//   CourseLesson as UICourseLesson,
//   CourseQuiz as UICourseQuiz,
// } from "@/types/course";

// // ---------------- DTOs (match /api/courses/[slug]) ----------------
// interface CourseDTO {
//   id: string;
//   slug: string;
//   title: string;
//   summary: string | null;
//   coverImage: string | null;
//   modules: CourseModuleDTO[];
// }
// interface CourseModuleDTO {
//   id: string;
//   title: string;
//   description?: string;
//   lessons: CourseLessonDTO[];
// }
// interface CourseLessonDTO {
//   id: string;
//   title: string;
//   videoUrl?: string;
//   body?: any;
//   quiz?: CourseQuizDTO;
// }
// interface CourseQuizDTO {
//   passingScore?: number;
//   questions: {
//     id: string;
//     question: string;
//     options: string[];
//     correctIndex: number;
//   }[];
// }

// type QuizAnswers = Record<string, number | null>;

// // ---------------- Helpers (pure) ----------------

// function computeAdjacentLesson(
//   modules: UICourseModule[],
//   moduleIndex: number,
//   lessonIndex: number
// ) {
//   const pairs: Array<{ m: number; l: number }> = [];
//   modules.forEach((m, mIdx) => {
//     (m.lessons ?? []).forEach((_l, lIdx) => pairs.push({ m: mIdx, l: lIdx }));
//   });

//   const currentFlatIdx = pairs.findIndex((p) => p.m === moduleIndex && p.l === lessonIndex);
//   const prev = currentFlatIdx > 0 ? pairs[currentFlatIdx - 1] : null;
//   const next =
//     currentFlatIdx >= 0 && currentFlatIdx < pairs.length - 1 ? pairs[currentFlatIdx + 1] : null;

//   return { prev, next };
// }

// function normalizeModules(dtoModules: CourseModuleDTO[] | undefined): UICourseModule[] {
//   if (!Array.isArray(dtoModules)) return [];
//   return dtoModules.map<UICourseModule>((m) => ({
//     id: m.id,
//     title: m.title,
//     description: m.description,
//     lessons: (m.lessons ?? []).map<UICourseLesson>((l) => ({
//       id: l.id,
//       title: l.title,
//       videoUrl: l.videoUrl ?? "",
//       body: l.body,
//       quiz: l.quiz
//         ? (({
//             questions:
//               l.quiz.questions?.map((q) => ({
//                 id: q.id,
//                 question: q.question,
//                 options: q.options,
//                 correctIndex: q.correctIndex,
//               })) ?? [],
//             passingScore: l.quiz.passingScore,
//           } as any) as UICourseQuiz)
//         : undefined,
//     })),
//   }));
// }

// /** LocalStorage keys (fallback + resume). */
// const progressKey = (courseId: string) => `courseProgress:${courseId}`;
// const resumeKey = (courseId: string) => `courseResume:${courseId}`;

// function loadLocalProgress(courseId: string): { completedModuleIds: string[] } {
//   try {
//     const raw = localStorage.getItem(progressKey(courseId));
//     if (!raw) return { completedModuleIds: [] };
//     const parsed = JSON.parse(raw);
//     if (!Array.isArray(parsed?.completedModuleIds)) return { completedModuleIds: [] };
//     return { completedModuleIds: parsed.completedModuleIds as string[] };
//   } catch {
//     return { completedModuleIds: [] };
//   }
// }

// function saveLocalProgress(courseId: string, completedModuleIds: string[]) {
//   try {
//     localStorage.setItem(progressKey(courseId), JSON.stringify({ completedModuleIds }));
//   } catch {
//     // ignore storage errors (private mode, quota, etc.)
//   }
// }

// function saveResume(courseId: string, moduleId: string, lessonId: string) {
//   try {
//     localStorage.setItem(resumeKey(courseId), JSON.stringify({ moduleId, lessonId }));
//   } catch {
//     // ignore
//   }
// }

// function loadResume(courseId: string): { moduleId?: string; lessonId?: string } {
//   try {
//     const raw = localStorage.getItem(resumeKey(courseId));
//     if (!raw) return {};
//     const parsed = JSON.parse(raw);
//     return {
//       moduleId: typeof parsed?.moduleId === "string" ? parsed.moduleId : undefined,
//       lessonId: typeof parsed?.lessonId === "string" ? parsed.lessonId : undefined,
//     };
//   } catch {
//     return {};
//   }
// }

// function isOnModuleLastLesson(
//   modules: UICourseModule[],
//   moduleIndex: number,
//   lessonIndex: number
// ): boolean {
//   const m = modules[moduleIndex];
//   if (!m || !Array.isArray(m.lessons) || m.lessons.length === 0) return false;
//   return lessonIndex === m.lessons.length - 1;
// }

// function computeUnlocked(
//   modules: UICourseModule[],
//   completedModuleIds: Set<string>
// ): Set<number> {
//   const unlocked = new Set<number>();
//   if (modules.length === 0) return unlocked;

//   unlocked.add(0);

//   let farthest = -1;
//   modules.forEach((m, idx) => {
//     if (completedModuleIds.has(m.id)) {
//       unlocked.add(idx);
//       farthest = Math.max(farthest, idx);
//     }
//   });

//   const nextIdx = farthest + 1;
//   if (nextIdx >= 0 && nextIdx < modules.length) unlocked.add(nextIdx);

//   return unlocked;
// }

// function computePercentClient(totalModules: number, completedCount: number): number {
//   if (totalModules <= 0) return 0;
//   const pct = Math.round((completedCount / totalModules) * 100);
//   return Math.max(0, Math.min(100, pct));
// }

// /** Smoothly scroll to top. Isolated helper so it can be called from handlers. */
// function scrollToTopSmooth() {
//   try {
//     window.scrollTo({ top: 0, behavior: "smooth" });
//   } catch {
//     // no-op (SSR/unsupported environments)
//   }
// }

// // =============================================================================

// export default function CoursePage() {
//   const router = useRouter();
//   const access = usePaidAccess();

//   // Access gate — unchanged
//   useEffect(() => {
//     if (access.loading) return;
//     if (!access.hasAccess) {
//       router.replace("/dashboard/upgrade");
//     }
//   }, [access.loading, access.hasAccess, router]);

//   const searchParams = useSearchParams();
//   const slug = (searchParams?.get("slug") || "cultural-awareness-training").trim();

//   // Course load state
//   const [course, setCourse] = useState<CourseDTO | null>(null);
//   const [loadingCourse, setLoadingCourse] = useState<boolean>(true);
//   const [loadError, setLoadError] = useState<string>("");

//   useEffect(() => {
//     if (access.loading || !access.hasAccess) return;

//     let cancelled = false;
//     const run = async () => {
//       setLoadingCourse(true);
//       setLoadError("");
//       try {
//         const res = await fetch(`/api/courses/${encodeURIComponent(slug)}`, {
//           cache: "no-store",
//         });
//         const data = await res.json();
//         if (!res.ok) throw new Error(data?.error || "Failed to load course");
//         if (!cancelled) setCourse(data.course as CourseDTO);
//       } catch (e: any) {
//         if (!cancelled) setLoadError(e?.message || "Unable to load course");
//       } finally {
//         if (!cancelled) setLoadingCourse(false);
//       }
//     };

//     run();
//     return () => {
//       cancelled = true;
//     };
//   }, [access.loading, access.hasAccess, slug]);

//   // Normalize modules for UI
//   const uiModules: UICourseModule[] = useMemo(
//     () => normalizeModules(course?.modules),
//     [course?.modules]
//   );
//   const totalModules = uiModules.length;

//   // Current indices
//   const [currentModuleIndex, setCurrentModuleIndex] = useState<number>(0);
//   const [currentLessonIndex, setCurrentLessonIndex] = useState<number>(0);

//   // Reset to first lesson when module changes
//   useEffect(() => {
//     setCurrentLessonIndex(0);
//   }, [currentModuleIndex]);

//   // Current module/lesson derived
//   const currentModule = useMemo(() => {
//     if (!uiModules.length) return null;
//     return uiModules[currentModuleIndex] || uiModules[0] || null;
//   }, [uiModules, currentModuleIndex]);

//   const currentLesson = useMemo(() => {
//     if (!currentModule?.lessons?.length) return null;
//     return currentModule.lessons[currentLessonIndex] || currentModule.lessons[0] || null;
//   }, [currentModule, currentLessonIndex]);

//   const { prev: prevLesson, next: nextLesson } = useMemo(() => {
//     return computeAdjacentLesson(uiModules, currentModuleIndex, currentLessonIndex);
//   }, [uiModules, currentModuleIndex, currentLessonIndex]);

//   // Quiz UI state
//   const [answers, setAnswers] = useState<QuizAnswers>({});
//   const [revealed, setRevealed] = useState<boolean>(false);
//   const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

//   // Clear quiz state on lesson change + store resume pointer
//   useEffect(() => {
//     setAnswers({});
//     setRevealed(false);
//     if (autoAdvanceTimer.current) {
//       clearTimeout(autoAdvanceTimer.current);
//       autoAdvanceTimer.current = null;
//     }

//     if (course?.id && currentModule && currentLesson) {
//       saveResume(course.id, currentModule.id, currentLesson.id);
//     }
//   }, [currentLesson?.id, currentModule?.id]);

//   // ---------------- SERVER PROGRESS: completion state + sync ----------------

//   const [completedModuleIds, setCompletedModuleIds] = useState<Set<string>>(new Set());
//   const [seededFromServer, setSeededFromServer] = useState<boolean>(false);

//   // Seed from local, then hydrate from server
//   useEffect(() => {
//     if (!course?.id) return;

//     // Local optimistic seed
//     const local = loadLocalProgress(course.id);
//     const localSet = new Set(local.completedModuleIds);
//     setCompletedModuleIds(localSet);

//     // Server seed
//     (async () => {
//       try {
//         const res = await fetch(
//           `/api/course/progress?courseId=${encodeURIComponent(course.id)}`,
//           { cache: "no-store" }
//         );
//         const json = await res.json().catch(() => ({}));

//         if (json?.meta) {
//           const serverArr: string[] = Array.isArray(json.meta.completedModuleIds)
//             ? json.meta.completedModuleIds.filter((s: unknown) => typeof s === "string")
//             : [];
//           const serverSet = new Set(serverArr);

//           setCompletedModuleIds(serverSet);
//           saveLocalProgress(course.id, Array.from(serverSet));

//           const lastModuleId: string | null =
//             typeof json.meta.lastModuleId === "string" ? json.meta.lastModuleId : null;

//           if (lastModuleId && uiModules.length) {
//             const mIdx = uiModules.findIndex((m) => m.id === lastModuleId);
//             if (mIdx >= 0) {
//               setCurrentModuleIndex(mIdx);
//               setCurrentLessonIndex(0);
//             }
//           } else {
//             const { moduleId, lessonId } = loadResume(course.id);
//             if (moduleId) {
//               const mIdx = uiModules.findIndex((m) => m.id === moduleId);
//               if (mIdx >= 0) {
//                 setCurrentModuleIndex(mIdx);
//                 if (lessonId && uiModules[mIdx]?.lessons?.length) {
//                   const lIdx = uiModules[mIdx].lessons.findIndex((l) => l.id === lessonId);
//                   if (lIdx >= 0) setCurrentLessonIndex(lIdx);
//                 }
//               }
//             }
//           }
//         }
//       } catch {
//         // Keep local fallback
//       } finally {
//         setSeededFromServer(true);
//       }
//     })();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [course?.id, uiModules.length]);

//   // Compute unlocked indices from completion state
//   const unlockedModuleIndices: Set<number> = useMemo(() => {
//     return computeUnlocked(uiModules, completedModuleIds);
//   }, [uiModules, completedModuleIds]);

//   async function saveProgressSnapshot(opts?: { lastModuleId?: string | null }) {
//     if (!course?.id) return;

//     const completedArr = Array.from(completedModuleIds);
//     const percent = computePercentClient(totalModules, completedArr.length);

//     const body = {
//       courseId: course.id,
//       completedModuleIds: completedArr,
//       lastModuleId: typeof opts?.lastModuleId === "string" ? opts.lastModuleId : null,
//       percent, // explicit so progress bars update immediately on next GET
//     };

//     try {
//       await fetch("/api/course/progress", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(body),
//         cache: "no-store",
//       });
//     } catch {
//       // swallow — local remains, retry later
//     }
//   }

//   async function markCurrentModuleComplete(): Promise<boolean> {
//     if (!currentModule || !course?.id) return false;

//     const id = currentModule.id;
//     if (completedModuleIds.has(id)) return false;

//     const next = new Set(completedModuleIds);
//     next.add(id);
//     setCompletedModuleIds(next);
//     saveLocalProgress(course.id, Array.from(next));

//     await saveProgressSnapshot({ lastModuleId: id });
//     return true;
//   }

//   // ---------------- Handlers ----------------

//   const handleQuizChange = (questionId: string, optionIndex: number) => {
//     setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
//   };

//   const handleQuizSubmit = async () => {
//     setRevealed(true);
//     await markCurrentModuleComplete();

//     if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
//     autoAdvanceTimer.current = setTimeout(() => {
//       const { next } = computeAdjacentLesson(uiModules, currentModuleIndex, currentLessonIndex);
//       if (!next) return;

//       const crossingModule = next.m !== currentModuleIndex;
//       if (crossingModule && !unlockedModuleIndices.has(next.m)) return;

//       setCurrentModuleIndex(next.m);
//       setCurrentLessonIndex(next.l);

//       // [SCROLL TOP ✅] Enhance UX when entering a new module
//       if (crossingModule) scrollToTopSmooth();
//     }, 600);

//     return true;
//   };

//   const goPrev = () => {
//     if (!prevLesson) return;
//     const crossingModule = prevLesson.m !== currentModuleIndex;
//     setCurrentModuleIndex(prevLesson.m);
//     setCurrentLessonIndex(prevLesson.l);
//     if (crossingModule) scrollToTopSmooth();
//   };

//   const nextWouldEnterLockedModule =
//     !!nextLesson &&
//     nextLesson.m !== currentModuleIndex &&
//     !unlockedModuleIndices.has(nextLesson.m);

//   const goNext = () => {
//     if (!nextLesson) return;
//     const crossingModule = nextLesson.m !== currentModuleIndex;

//     if (nextWouldEnterLockedModule) {
//       console.warn("Blocked: Next would enter a locked module. Complete current module first.");
//       return;
//     }

//     setCurrentModuleIndex(nextLesson.m);
//     setCurrentLessonIndex(nextLesson.l);

//     // [SCROLL TOP ✅] Only when we cross into a different module
//     if (crossingModule) scrollToTopSmooth();
//   };

//   const handleSelectLesson = (mIdx: number, lIdx: number) => {
//     if (!unlockedModuleIndices.has(mIdx)) return;
//     const crossingModule = mIdx !== currentModuleIndex;
//     setCurrentModuleIndex(mIdx);
//     setCurrentLessonIndex(lIdx);
//     // Optional: scroll when user selects a different module from the sidebar.
//     if (crossingModule) scrollToTopSmooth();
//   };

//   // ---------------- Render states (unchanged) ----------------

//   if (access.loading) {
//     return (
//       <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
//         <p className="text-white text-xl">Checking access…</p>
//       </section>
//     );
//   }
//   if (!access.hasAccess) {
//     return (
//       <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
//         <p className="text-white text-xl">Redirecting…</p>
//       </section>
//     );
//   }
//   if (loadingCourse) {
//     return (
//       <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
//         <p className="text-white text-xl">Loading course…</p>
//       </section>
//     );
//   }
//   if (loadError || !course) {
//     return (
//       <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300 px-6 text-center">
//         <div className="bg-white/90 rounded-xl shadow p-6 max-w-lg">
//           <h2 className="text-xl font-bold text-red-700 mb-2">Unable to load course</h2>
//           <p className="text-gray-700">{loadError || "Unknown error."}</p>
//         </div>
//       </section>
//     );
//   }

//   const onLastLessonNoQuiz =
//     !!currentModule &&
//     isOnModuleLastLesson(uiModules, currentModuleIndex, currentLessonIndex) &&
//     !currentLesson?.quiz;

//   const isCurrentModuleCompleted =
//     !!currentModule && completedModuleIds.has(currentModule.id);

//   return (
//     <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-10 px-4 sm:px-6">
//       {/* Header */}
//       <div className="max-w-6xl mx-auto mb-6 text-white">
//         <h1 className="text-3xl font-bold">{course.title}</h1>
//         {course.summary && <p className="opacity-90 mt-1">{course.summary}</p>}
//       </div>

//       <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
//         {/* Sidebar (Modules) */}
//         <div className="lg:col-span-4">
//           <ModuleList
//             modules={uiModules}
//             currentModuleIndex={currentModuleIndex}
//             currentLessonIndex={currentLessonIndex}
//             onSelectModule={(idx) => {
//               if (!unlockedModuleIndices.has(idx)) return;
//               const crossingModule = idx !== currentModuleIndex;
//               setCurrentModuleIndex(idx);
//               setCurrentLessonIndex(0);
//               if (crossingModule) scrollToTopSmooth();
//             }}
//             unlockedModuleIndices={unlockedModuleIndices}
//             onSelectLesson={handleSelectLesson}
//           />
//         </div>

//         {/* Main content */}
//         <div className="lg:col-span-8">
//           <div className="bg-white rounded-2xl shadow-lg p-5 space-y-5">
//             {/* Lesson Title + Controls */}
//             <div className="flex items-center justify-between">
//               <div>
//                 <h2 className="text-2xl font-bold text-blue-900">
//                   {currentLesson?.title || "Lesson"}
//                 </h2>
//                 {currentModule?.title && (
//                   <p className="text-sm text-gray-500">In module: {currentModule.title}</p>
//                 )}
//                 {isCurrentModuleCompleted && (
//                   <p className="text-xs text-emerald-700 mt-1 font-medium">Module completed</p>
//                 )}
//               </div>

//               <div className="flex flex-col items-end gap-1">
//                 <div className="flex gap-2">
//                   <button
//                     disabled={!prevLesson}
//                     className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50 hover:bg-gray-50"
//                     onClick={goPrev}
//                   >
//                     ← Prev
//                   </button>
//                   <button
//                     disabled={!nextLesson || nextWouldEnterLockedModule}
//                     className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50 hover:bg-gray-50"
//                     onClick={goNext}
//                     aria-disabled={!nextLesson || nextWouldEnterLockedModule}
//                     aria-label={
//                       nextWouldEnterLockedModule
//                         ? "Next lesson is in a locked module. Complete current module first."
//                         : "Go to next lesson"
//                     }
//                   >
//                     Next →
//                   </button>
//                 </div>
//                 {nextWouldEnterLockedModule && (
//                   <p className="text-[11px] text-amber-700">
//                     Complete this module to unlock the next one.
//                   </p>
//                 )}
//               </div>
//             </div>

//             {/* Video (optional) */}
//             {currentLesson?.videoUrl && (
//               <VideoPlayer src={currentLesson.videoUrl} title={currentLesson.title} />
//             )}

//             {/* Rich body */}
//             {Array.isArray(currentLesson?.body) ? (
//               <PortableTextRenderer value={currentLesson?.body} className="prose prose-blue max-w-none" />
//             ) : currentLesson?.body ? (
//               <div className="prose max-w-none">
//                 <p>{String(currentLesson.body)}</p>
//               </div>
//             ) : null}

//             {/* Quiz (optional; reveal-only) */}
//             {!!currentLesson?.quiz && (
//               <div className="mt-4">
//                 <QuizCard
//                   quiz={currentLesson.quiz}
//                   answers={answers}
//                   revealed={revealed}
//                   onChange={handleQuizChange}
//                   onSubmit={handleQuizSubmit}
//                 />
//               </div>
//             )}

//             {/* Manual completion for modules WITHOUT quiz, only on the final lesson */}
//             {onLastLessonNoQuiz && !isCurrentModuleCompleted && (
//               <div className="pt-2">
//                 <button
//                   onClick={async () => {
//                     await markCurrentModuleComplete();
//                     const { next } = computeAdjacentLesson(uiModules, currentModuleIndex, currentLessonIndex);
//                     if (next && (next.m === currentModuleIndex || unlockedModuleIndices.has(next.m))) {
//                       const crossingModule = next.m !== currentModuleIndex;
//                       setCurrentModuleIndex(next.m);
//                       setCurrentLessonIndex(next.l);
//                       if (crossingModule) scrollToTopSmooth();
//                     }
//                   }}
//                   className="inline-flex items-center justify-center px-5 py-2 rounded-lg font-semibold
//                              bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-transform hover:scale-[1.02]"
//                 >
//                   Mark module complete
//                 </button>
//                 <p className="text-xs text-gray-500 mt-2">
//                   This module has no quiz. Click to confirm you’ve completed it and unlock the next module.
//                 </p>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </section>
//   );
// }

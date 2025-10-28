// app/dashboard/course/page.tsx
//
// Purpose
// -------
// Render the paid course UI and *persist* progress reliably so that:
//  • Any progress UI (dashboard ring/bar) reflects real completion
//  • Modules unlock sequentially and stay unlocked across navigation
//  • Your place in the course is remembered (resume)
//
// Surgical updates in this revision (look for tags):
//  - [ENDPOINT FIX] (retained from prior step): use /api/course/progress (singular).
//  - [QUIZ SUBMIT ✅]: make onSubmit async, await save, and resolve promise so buttons don’t get stuck.
//  - [AUTO-ADVANCE ✅]: after submit, short delay then recompute the next pointer and advance if permitted.
//  - [LOCK GUARD ✅]: preserved; “Next” cannot cross into a locked module.
//  - No changes to signup/staff/payment flows.
//
// Pillars: efficiency (minimal fetches), robustness (awaits + guards), simplicity (clear helpers),
// ease-of-management (explicit comments), security (no new surface).

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

// ---------------- DTOs (match /api/courses/[slug]) ----------------
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
  passingScore?: number; // reveal-only; not used for scoring
  questions: {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
  }[];
}

type QuizAnswers = Record<string, number | null>;

// ---------------- Helpers (pure) ----------------

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

/** Normalize API DTO → UI types (keeps your components unchanged). */
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

/** Load local optimistic progress (fallback if server unreachable). */
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

/** Save local optimistic progress (does not affect server). */
function saveLocalProgress(courseId: string, completedModuleIds: string[]) {
  try {
    localStorage.setItem(progressKey(courseId), JSON.stringify({ completedModuleIds }));
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

/** Save a tiny resume pointer to local storage (moduleId + lessonId). */
function saveResume(courseId: string, moduleId: string, lessonId: string) {
  try {
    localStorage.setItem(resumeKey(courseId), JSON.stringify({ moduleId, lessonId }));
  } catch {
    // ignore
  }
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

  unlocked.add(0); // Module 0 unlocked by default

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

/** Compute % complete on client as a safe fallback and to send server-side. */
function computePercentClient(totalModules: number, completedCount: number): number {
  if (totalModules <= 0) return 0;
  const pct = Math.round((completedCount / totalModules) * 100);
  return Math.max(0, Math.min(100, pct));
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

  // Clear quiz state on lesson change + store resume pointer
  useEffect(() => {
    setAnswers({});
    setRevealed(false);
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }

    // RESUME: keep a tiny resume pointer as user navigates lessons
    if (course?.id && currentModule && currentLesson) {
      saveResume(course.id, currentModule.id, currentLesson.id);
    }
  }, [currentLesson?.id, currentModule?.id]);

  // ---------------- SERVER PROGRESS: completion state + sync ----------------

  // Keep completed module IDs in memory (NEVER set on initial render implicitly)
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
        // [ENDPOINT FIX]: correct path is /api/course/progress (singular)
        const res = await fetch(
          `/api/course/progress?courseId=${encodeURIComponent(course.id)}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => ({}));

        // Only adopt server values if meta exists
        if (json?.meta) {
          const serverArr: string[] = Array.isArray(json.meta.completedModuleIds)
            ? json.meta.completedModuleIds.filter((s: unknown) => typeof s === "string")
            : [];
          const serverSet = new Set(serverArr);

          setCompletedModuleIds(serverSet);
          saveLocalProgress(course.id, Array.from(serverSet));

          // RESUME: if server carries lastModuleId, try to restore to it; else local pointer.
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

  /** Persist a snapshot to the server. We also provide a client-computed percent so
   *  any progress UI can update immediately after the POST succeeds. */
  async function saveProgressSnapshot(opts?: { lastModuleId?: string | null }) {
    if (!course?.id) return;

    const completedArr = Array.from(completedModuleIds);
    const percent = computePercentClient(totalModules, completedArr.length);

    const body = {
      courseId: course.id,
      completedModuleIds: completedArr,
      lastModuleId: typeof opts?.lastModuleId === "string" ? opts.lastModuleId : null,
      percent, // sent to server so dashboard/progress bars can read fresh value on next GET
    };

    try {
      // [ENDPOINT FIX]: correct path is /api/course/progress (singular)
      const res = await fetch("/api/course/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      // We don't *need* the response body here; await ensures persistence finished.
      if (!res.ok) {
        // Soft-fail: keep local state; server can be retried later.
        console.warn("[progress] server refused POST; progress will retry on next action.");
      }
    } catch {
      // Swallow errors; local state remains and next user action can retry.
    }
  }

  /** Idempotently mark the *current* module complete and save to server.
   *  Returns a boolean indicating whether a new completion occurred. */
  async function markCurrentModuleComplete(): Promise<boolean> {
    if (!currentModule || !course?.id) return false;

    const id = currentModule.id;
    if (completedModuleIds.has(id)) return false; // already complete

    // Update local set immediately for snappy UX (optimistic)
    const next = new Set(completedModuleIds);
    next.add(id);
    setCompletedModuleIds(next);
    saveLocalProgress(course.id, Array.from(next));

    // Persist on server and include lastModuleId for resume pointers
    await saveProgressSnapshot({ lastModuleId: id });
    return true;
  }

  // ---------------- Handlers ----------------

  const handleQuizChange = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  /** [QUIZ SUBMIT ✅]
   *  Many quiz components set an internal "submitting" flag and clear it
   *  only when the provided onSubmit *resolves*. We make this async, await
   *  persistence, and then resolve to clear the "Submitting..." state.
   *  We also auto-advance shortly after, recomputing the next pointer
   *  to avoid race conditions with state updates/unlocks.
   */
  const handleQuizSubmit = async () => {
    // 1) Reveal feedback immediately
    setRevealed(true);

    // 2) Persist completion and progress (await to ensure submit finishes cleanly)
    await markCurrentModuleComplete();

    // 3) Auto-advance after a short delay:
    //    - Allow state/unlock recomputations to settle
    //    - Recompute the next pointer at the time of advance
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = setTimeout(() => {
      // Recompute adjacent lesson using the latest indices
      const { next } = computeAdjacentLesson(uiModules, currentModuleIndex, currentLessonIndex);
      if (!next) return;

      // Respect lock when crossing modules
      if (next.m !== currentModuleIndex && !unlockedModuleIndices.has(next.m)) {
        return; // still locked; user remains on current module
      }

      setCurrentModuleIndex(next.m);
      setCurrentLessonIndex(next.l);
    }, 600); // shorter, snappier UX while still letting state settle

    // 4) Important: return (resolve) to allow QuizCard to exit "Submitting..."
    return true;
  };

  const goPrev = () => {
    if (!prevLesson) return;
    setCurrentModuleIndex(prevLesson.m);
    setCurrentLessonIndex(prevLesson.l);
  };

  // Derived flag: would pressing “Next” cross into a *locked* module?
  const nextWouldEnterLockedModule =
    !!nextLesson &&
    nextLesson.m !== currentModuleIndex &&
    !unlockedModuleIndices.has(nextLesson.m);

  const goNext = () => {
    if (!nextLesson) return;

    // [LOCK GUARD ✅]: block crossing into a locked module
    if (nextWouldEnterLockedModule) {
      console.warn("Blocked: Next would enter a locked module. Complete current module first.");
      return;
    }

    setCurrentModuleIndex(nextLesson.m);
    setCurrentLessonIndex(nextLesson.l);
  };

  const handleSelectLesson = (mIdx: number, lIdx: number) => {
    // Respect locking — ignore clicks on locked modules/lessons
    if (!unlockedModuleIndices.has(mIdx)) return;
    setCurrentModuleIndex(mIdx);
    setCurrentLessonIndex(lIdx);
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

  // UX helper for the “no-quiz final lesson” manual completion button
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
              setCurrentModuleIndex(idx);
              setCurrentLessonIndex(0);
            }}
            // Locking UI/behavior
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
                    // [LOCK GUARD ✅]: disable if it would enter a locked module
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
                  // [QUIZ SUBMIT ✅]: async submit that resolves when save finishes
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
                    // After completing a no-quiz module, attempt to advance (respect lock)
                    const { next } = computeAdjacentLesson(uiModules, currentModuleIndex, currentLessonIndex);
                    if (next && (next.m === currentModuleIndex || unlockedModuleIndices.has(next.m))) {
                      setCurrentModuleIndex(next.m);
                      setCurrentLessonIndex(next.l);
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
// // Purpose
// // -------
// // Render the paid course UI and *persist* progress reliably so that:
// //  • The dashboard ring reflects real completion
// //  • Modules unlock sequentially and stay unlocked across navigation
// //  • Your place in the course is remembered (resume)
// //
// // What changed (surgical, look for "SERVER PROGRESS" and "RESUME"):
// //  1) On completion we now POST a client-computed `percent` along with
// //     `completedModuleIds` and `lastModuleId`. This guarantees the dashboard
// //     ring moves even if the server-side percent calculation is conservative.
// //  2) We never overwrite local/server completion with “empty” values.
// //     We only adopt server values when the server actually returns `meta`.
// //  3) We persist a lightweight resume pointer (moduleId + lessonId) in
// //     localStorage and (optionally) `lastModuleId` on the server;
// //     on load we restore to the last meaningful place.
// //  4) Unlock calculation remains sequential and stable.
// //
// // No other flows touched (auth, staff/owner access, payments, video, quizzes).

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
//   passingScore?: number; // quizzes are reveal-only; not used for scoring
//   questions: {
//     id: string;
//     question: string;
//     options: string[];
//     correctIndex: number; // 0-based
//   }[];
// }

// type QuizAnswers = Record<string, number | null>;

// // ---------------- Helpers (pure) ----------------

// /** Linearize lessons to compute previous/next navigation pairs. */
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

// /** Normalize API DTO → UI types (keeps your Video/Body/Quiz components unchanged). */
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

// /** Load local optimistic progress (fallback if server unreachable). */
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

// /** Save local optimistic progress (does not affect server). */
// function saveLocalProgress(courseId: string, completedModuleIds: string[]) {
//   try {
//     localStorage.setItem(progressKey(courseId), JSON.stringify({ completedModuleIds }));
//   } catch {
//     // ignore storage errors (private mode, quota, etc.)
//   }
// }

// /** Save a tiny resume pointer to local storage (moduleId + lessonId). */
// function saveResume(courseId: string, moduleId: string, lessonId: string) {
//   try {
//     localStorage.setItem(resumeKey(courseId), JSON.stringify({ moduleId, lessonId }));
//   } catch {
//     // ignore
//   }
// }

// /** Load resume pointer from local storage. */
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

// /** True if the lesson is the last lesson within its module. */
// function isOnModuleLastLesson(
//   modules: UICourseModule[],
//   moduleIndex: number,
//   lessonIndex: number
// ): boolean {
//   const m = modules[moduleIndex];
//   if (!m || !Array.isArray(m.lessons) || m.lessons.length === 0) return false;
//   return lessonIndex === m.lessons.length - 1;
// }

// /**
//  * Compute which module indices should be unlocked.
//  * Rules (sequential locking):
//  *  - Always unlock module index 0
//  *  - Unlock every module that is already completed
//  *  - Also unlock the module immediately after the *highest* completed index
//  */
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

// /** Compute % complete client-side as a safe fallback. */
// function computePercentClient(totalModules: number, completedCount: number): number {
//   if (totalModules <= 0) return 0;
//   const pct = Math.round((completedCount / totalModules) * 100);
//   return Math.max(0, Math.min(100, pct));
// }

// // =============================================================================

// export default function CoursePage() {
//   const router = useRouter();
//   const access = usePaidAccess();

//   // Access check — unchanged
//   useEffect(() => {
//     if (access.loading) return;
//     if (!access.hasAccess) {
//       router.replace("/dashboard/upgrade");
//     }
//   }, [access.loading, access.hasAccess, router]);

//   // Canonical slug param
//   const searchParams = useSearchParams();
//   const slug = (searchParams?.get("slug") || "cultural-awareness-training").trim();

//   // Course load state
//   const [course, setCourse] = useState<CourseDTO | null>(null);
//   const [loadingCourse, setLoadingCourse] = useState<boolean>(true);
//   const [loadError, setLoadError] = useState<string>("");

//   // Fetch course (server source of truth)
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

//   // Clear quiz state on lesson change
//   useEffect(() => {
//     setAnswers({});
//     setRevealed(false);
//     if (autoAdvanceTimer.current) {
//       clearTimeout(autoAdvanceTimer.current);
//       autoAdvanceTimer.current = null;
//     }

//     // RESUME: keep a tiny resume pointer as user navigates lessons
//     if (course?.id && currentModule && currentLesson) {
//       saveResume(course.id, currentModule.id, currentLesson.id);
//     }
//   }, [currentLesson?.id, currentModule?.id]); // save only when identity changes

//   // ---------------- SERVER PROGRESS: completion state + sync ----------------

//   // Keep completed module IDs in memory (NEVER set on initial render implicitly)
//   const [completedModuleIds, setCompletedModuleIds] = useState<Set<string>>(new Set());
//   const [seededFromServer, setSeededFromServer] = useState<boolean>(false);

//   // Seed from local (optimistic), then hydrate from server (prefer server meta only if present).
//   useEffect(() => {
//     if (!course?.id) return;

//     // 1) Local optimistic seed
//     const local = loadLocalProgress(course.id);
//     const localSet = new Set(local.completedModuleIds);
//     setCompletedModuleIds(localSet);

//     // 2) Server seed
//     (async () => {
//       try {
//         const res = await fetch(
//           `/api/courses/progress?courseId=${encodeURIComponent(course.id)}`,
//           { cache: "no-store" }
//         );
//         const json = await res.json().catch(() => ({}));

//         // Only adopt server values if `meta` actually exists
//         if (json?.meta) {
//           const serverArr: string[] = Array.isArray(json.meta.completedModuleIds)
//             ? json.meta.completedModuleIds.filter((s: unknown) => typeof s === "string")
//             : [];
//           const serverSet = new Set(serverArr);

//           setCompletedModuleIds(serverSet);
//           saveLocalProgress(course.id, Array.from(serverSet));

//           // RESUME: if server carries lastModuleId, try to restore to it;
//           // otherwise, try local resume pointer; otherwise leave as-is (module 0).
//           const lastModuleId: string | null =
//             typeof json.meta.lastModuleId === "string" ? json.meta.lastModuleId : null;

//           // We restore ONLY once (initial seed) to avoid fighting user navigation.
//           if (lastModuleId && uiModules.length) {
//             const mIdx = uiModules.findIndex((m) => m.id === lastModuleId);
//             if (mIdx >= 0) {
//               setCurrentModuleIndex(mIdx);
//               setCurrentLessonIndex(0);
//             }
//           } else {
//             // Try local resume pointer (moduleId, lessonId)
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
//         } else {
//           // No server meta (e.g., first-time user) → keep local as-is
//         }
//       } catch {
//         // Network/server failure → keep local as-is
//       } finally {
//         setSeededFromServer(true);
//       }
//     })();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [course?.id, uiModules.length]); // seed once when course + modules are ready

//   // Compute unlocked indices based on completion
//   const unlockedModuleIndices: Set<number> = useMemo(() => {
//     return computeUnlocked(uiModules, completedModuleIds);
//   }, [uiModules, completedModuleIds]);

//   /** Persist a snapshot to the server. The server computes/stores percent —
//    *  but we also provide a client-computed `percent` to guarantee updates. */
//   async function saveProgressSnapshot(opts?: { lastModuleId?: string | null }) {
//     if (!course?.id) return;

//     const completedArr = Array.from(completedModuleIds);
//     const percent = computePercentClient(totalModules, completedArr.length);

//     const body = {
//       courseId: course.id,
//       completedModuleIds: completedArr,
//       lastModuleId: typeof opts?.lastModuleId === "string" ? opts.lastModuleId : null,
//       percent, // SERVER PROGRESS: explicit percent to ensure dashboard ring updates
//     };

//     try {
//       await fetch("/api/courses/progress", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(body),
//         cache: "no-store",
//       });
//     } catch {
//       // Swallow errors; next user action can retry. Local state stays intact.
//     }
//   }

//   /** Idempotently mark the *current* module complete and save to server. */
//   async function markCurrentModuleComplete() {
//     if (!currentModule || !course?.id) return;

//     const id = currentModule.id;
//     if (completedModuleIds.has(id)) return; // already complete

//     const next = new Set(completedModuleIds);
//     next.add(id);
//     setCompletedModuleIds(next);
//     saveLocalProgress(course.id, Array.from(next));

//     // SERVER PROGRESS: include lastModuleId for resume; include percent
//     await saveProgressSnapshot({ lastModuleId: id });
//   }

//   // ---------------- Handlers ----------------

//   const handleQuizChange = (questionId: string, optionIndex: number) => {
//     setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
//   };

//   const handleQuizSubmit = () => {
//     // 1) Reveal green/red feedback (handled within <QuizCard/>)
//     setRevealed(true);

//     // 2) Mark the module complete (explicit action: quiz submit)
//     void markCurrentModuleComplete();

//     // 3) Auto-advance if there is a next lesson
//     if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
//     autoAdvanceTimer.current = setTimeout(() => {
//       if (nextLesson) {
//         setCurrentModuleIndex(nextLesson.m);
//         setCurrentLessonIndex(nextLesson.l);
//       }
//     }, 1500);
//   };

//   const goPrev = () => {
//     if (!prevLesson) return;
//     setCurrentModuleIndex(prevLesson.m);
//     setCurrentLessonIndex(prevLesson.l);
//   };

//   const goNext = () => {
//     if (!nextLesson) return;
//     setCurrentModuleIndex(nextLesson.m);
//     setCurrentLessonIndex(nextLesson.l);
//   };

//   const handleSelectLesson = (mIdx: number, lIdx: number) => {
//     // Respect locking — ignore clicks on locked modules/lessons
//     if (!unlockedModuleIndices.has(mIdx)) return;
//     setCurrentModuleIndex(mIdx);
//     setCurrentLessonIndex(lIdx);
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

//   // UX helper for the “no-quiz final lesson” manual completion button
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
//               setCurrentModuleIndex(idx);
//               setCurrentLessonIndex(0);
//             }}
//             // Locking UI/behavior
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

//               <div className="flex gap-2">
//                 <button
//                   disabled={!prevLesson}
//                   className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50 hover:bg-gray-50"
//                   onClick={goPrev}
//                 >
//                   ← Prev
//                 </button>
//                 <button
//                   disabled={!nextLesson}
//                   className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50 hover:bg-gray-50"
//                   onClick={goNext}
//                 >
//                   Next →
//                 </button>
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

//             {/* Quiz (optional; reveal-only — no score displayed) */}
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
//                     if (nextLesson) {
//                       setCurrentModuleIndex(nextLesson.m);
//                       setCurrentLessonIndex(nextLesson.l);
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





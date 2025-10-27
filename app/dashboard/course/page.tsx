// app/dashboard/course/page.tsx
//
// Purpose
// -------
// Render the paid Course experience using your existing components:
//  - <ModuleList />        (sidebar of modules/lessons)
//  - <VideoPlayer />       (lesson video)
//  - <PortableTextRenderer /> (rich text)
//  - <QuizCard />          (per-lesson quiz with reveal + auto-advance)
//
// New in this patch (UX-only; NO auth/payment changes):
// 1) Sequential unlock:
//    • Module 1 (index 0) is unlocked by default
//    • Module N+1 unlocks when Module N is completed
// 2) Module completion rules (non-invasive):
//    • If the *last lesson of the module* has a quiz: completing/submitting it marks the module complete
//    • If the *last lesson of the module* has NO quiz: a "Mark module complete" button appears
// 3) Progress persistence via localStorage (per course), so users can't just jump to the last module.
//
// Everything else (fetching, access gating, quiz reveal + auto-advance) remains untouched.
//
// Implementation Notes
// --------------------
// - We compute `unlockedModuleIndices` from `completedModuleIds`. Module 0 is always unlocked.
// - We persist progress in localStorage under key: `courseProgress:<courseId>`
//   Shape: { completedModuleIds: string[] }
// - We only mark complete when user is on the module's *last lesson*.
//   This keeps the definition of “completed” unambiguous.
//
// Pillars
// -------
// - Simplicity: no backend changes; fully client-driven gating.
// - Robustness: guards when data is missing; does not break existing flows.
// - Ease of management: clear comments; drop-in update.
// - Security: read-only data; no new server endpoints.
//
// ------------------------------------------------------------

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

// DTOs matching /api/courses/[slug]
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

// ---------- Helpers ----------
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
      // preserve quiz (and passingScore if present) via cast — no scoring here
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

// ---------- Progress persistence (localStorage) ----------
const progressKey = (courseId: string) => `courseProgress:${courseId}`;
function loadProgress(courseId: string): { completedModuleIds: string[] } {
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
function saveProgress(courseId: string, completedModuleIds: string[]) {
  try {
    localStorage.setItem(progressKey(courseId), JSON.stringify({ completedModuleIds }));
  } catch {
    // ignore quota errors safely; UX still works in-session
  }
}

// Is the user on the very last lesson of a given module?
function isOnModuleLastLesson(
  modules: UICourseModule[],
  moduleIndex: number,
  lessonIndex: number
): boolean {
  const m = modules[moduleIndex];
  if (!m || !Array.isArray(m.lessons) || m.lessons.length === 0) return false;
  return lessonIndex === m.lessons.length - 1;
}

export default function CoursePage() {
  const router = useRouter();
  const access = usePaidAccess();

  // Access gate (unchanged)
  useEffect(() => {
    if (access.loading) return;
    if (!access.hasAccess) {
      router.replace("/dashboard/upgrade");
    }
  }, [access.loading, access.hasAccess, router]);

  const searchParams = useSearchParams();
  const slug = (searchParams?.get("slug") || "cultural-awareness-training").trim();

  // Fetch course (unchanged)
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
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load course");
        }
        if (!cancelled) {
          setCourse(data.course as CourseDTO);
        }
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

  // Normalize for UI
  const uiModules: UICourseModule[] = useMemo(
    () => normalizeModules(course?.modules),
    [course?.modules]
  );

  // Current indices + derived current lesson
  const [currentModuleIndex, setCurrentModuleIndex] = useState<number>(0);
  const [currentLessonIndex, setCurrentLessonIndex] = useState<number>(0);

  // Progress state (completed modules → unlock next)
  const [completedModuleIds, setCompletedModuleIds] = useState<string[]>([]);

  // Load progress from localStorage when course arrives
  useEffect(() => {
    if (!course?.id) return;
    const { completedModuleIds } = loadProgress(course.id);
    setCompletedModuleIds(completedModuleIds);
  }, [course?.id]);

  // Compute which modules are unlocked: module 0 always; module N if module N-1 completed
  const unlockedModuleIndices: Set<number> = useMemo(() => {
    const set = new Set<number>();
    if (!uiModules.length) return set;
    set.add(0); // first module always unlocked
    for (let i = 1; i < uiModules.length; i++) {
      const prevModuleId = uiModules[i - 1]?.id;
      if (prevModuleId && completedModuleIds.includes(prevModuleId)) {
        set.add(i);
      }
    }
    // Also unlock any module already marked complete (allows revisiting)
    uiModules.forEach((m, idx) => {
      if (completedModuleIds.includes(m.id)) set.add(idx);
    });
    return set;
  }, [uiModules, completedModuleIds]);

  // When module changes, reset to first lesson (unchanged)
  useEffect(() => {
    setCurrentLessonIndex(0);
  }, [currentModuleIndex]);

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

  // Quiz UI state (unchanged behavior)
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [revealed, setRevealed] = useState<boolean>(false);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear quiz state when lesson changes
  useEffect(() => {
    setAnswers({});
    setRevealed(false);
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
  }, [currentLesson?.id]);

  const handleQuizChange = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  // NEW: mark module complete if user submits the quiz on the module's last lesson (if it has a quiz)
  const markCurrentModuleComplete = () => {
    if (!currentModule) return;
    const modId = currentModule.id;
    if (completedModuleIds.includes(modId)) return; // idempotent
    const updated = [...completedModuleIds, modId];
    setCompletedModuleIds(updated);
    if (course?.id) saveProgress(course.id, updated);
  };

  const handleQuizSubmit = () => {
    setRevealed(true);

    // If we're on the last lesson of the module, consider the module completed.
    if (isOnModuleLastLesson(uiModules, currentModuleIndex, currentLessonIndex)) {
      markCurrentModuleComplete();
    }

    // Auto-advance after short delay (unchanged)
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = setTimeout(() => {
      if (nextLesson) {
        setCurrentModuleIndex(nextLesson.m);
        setCurrentLessonIndex(nextLesson.l);
      }
    }, 1500);
  };

  // Manual navigation (unchanged)
  const goPrev = () => {
    if (!prevLesson) return;
    setCurrentModuleIndex(prevLesson.m);
    setCurrentLessonIndex(prevLesson.l);
  };
  const goNext = () => {
    if (!nextLesson) return;
    setCurrentModuleIndex(nextLesson.m);
    setCurrentLessonIndex(nextLesson.l);
  };

  // When a lesson is clicked in the sidebar, display it immediately (unchanged from previous UX fix)
  const handleSelectLesson = (mIdx: number, lIdx: number) => {
    // Prevent navigating into locked modules
    if (!unlockedModuleIndices.has(mIdx)) return;
    setCurrentModuleIndex(mIdx);
    setCurrentLessonIndex(lIdx);
  };

  // Render states (unchanged)
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

  // Are we on the last lesson of the current module, and that lesson has NO quiz?
  const onLastLessonNoQuiz =
    !!currentModule &&
    isOnModuleLastLesson(uiModules, currentModuleIndex, currentLessonIndex) &&
    !currentLesson?.quiz;

  const isCurrentModuleCompleted =
    !!currentModule && completedModuleIds.includes(currentModule.id);

  // Main UI
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
              // Prevent opening a locked module
              if (!unlockedModuleIndices.has(idx)) return;
              setCurrentModuleIndex(idx);
              setCurrentLessonIndex(0);
            }}
            unlockedModuleIndices={unlockedModuleIndices}
            onSelectLesson={handleSelectLesson}
          />
        </div>

        {/* Main content */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl shadow-lg p-5 space-y-5">
            {/* Lesson Title */}
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

              {/* Prev/Next lesson controls (unchanged) */}
              <div className="flex gap-2">
                <button
                  disabled={!prevLesson}
                  className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50 hover:bg-gray-50"
                  onClick={goPrev}
                >
                  ← Prev
                </button>
                <button
                  disabled={!nextLesson}
                  className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50 hover:bg-gray-50"
                  onClick={goNext}
                >
                  Next →
                </button>
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

            {/* Quiz (optional) */}
            {!!currentLesson?.quiz && (
              <div className="mt-4">
                <QuizCard
                  quiz={currentLesson.quiz}
                  answers={answers}
                  revealed={revealed}
                  onChange={handleQuizChange}
                  onSubmit={handleQuizSubmit}
                />
                {/* No scoring text by design */}
              </div>
            )}

            {/* NEW: If last lesson has NO quiz → provide an explicit completion button */}
            {onLastLessonNoQuiz && !isCurrentModuleCompleted && (
              <div className="pt-2">
                <button
                  onClick={() => {
                    // Mark module complete and unlock the next one immediately
                    markCurrentModuleComplete();
                    // Optionally move to next module's first lesson if it exists
                    if (nextLesson) {
                      setCurrentModuleIndex(nextLesson.m);
                      setCurrentLessonIndex(nextLesson.l);
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

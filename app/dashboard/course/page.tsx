// app/dashboard/course/page.tsx
//
// Purpose
// -------
// Render the paid Course experience using your existing components:
//  - <ModuleList />        (sidebar of modules/lessons)
//  - <VideoPlayer />       (lesson video)
//  - <PortableTextRenderer /> (rich text)
//  - <QuizCard />          (per-lesson quiz)
//
// Access rules:
// - Uses usePaidAccess() to gate the page. No flow changes.
//
// Key updates in this patch:
// - Removed scoring/percentage text entirely.
// - After the user clicks "Submit", we:
//    • set `revealed = true` so QuizCard highlights correct green / wrong red
//    • start a 1.5s timer to auto-advance to the next lesson (or next module's first lesson).
//    • if there is no next lesson at all, we simply stay on the last lesson.
// - Inputs are disabled after reveal to avoid edits during the short delay.
//
// Pillars
// -------
// - Efficiency : one fetch per slug; no-store to reflect fresh content.
// - Robustness : defensive checks for missing fields; graceful fallbacks.
// - Simplicity : normalization function + minimal state.
// - Ease of mgmt : clear comments; components stay decoupled.
// - Security : read-only data path; no changes to auth or payments.

"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePaidAccess } from "@/hooks/usePaidAccess";

// Course UI building blocks (import-only; logic untouched except passing new props)
import ModuleList from "@/components/course/ModuleList";
import PortableTextRenderer from "@/components/course/PortableTextRenderer";
import QuizCard from "@/components/course/QuizCard";
import VideoPlayer from "@/components/course/VideoPlayer";

// 🔒 UI types your components expect
import type {
  CourseModule as UICourseModule,
  CourseLesson as UICourseLesson,
  CourseQuiz as UICourseQuiz,
} from "@/types/course";

// ────────────────────────────────────────────────────────────
// Local DTOs (match /api/courses/[slug])
// ────────────────────────────────────────────────────────────
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
  videoUrl?: string; // optional in DTO (from Sanity)
  body?: any;
  quiz?: CourseQuizDTO;
}
interface CourseQuizDTO {
  passingScore?: number; // optional in API; ignored now (no scoring UI)
  questions: {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
  }[];
}

// Answers map for the current lesson quiz: questionId -> selected option index
type QuizAnswers = Record<string, number | null>;

// ────────────────────────────────────────────────────────────
// Utility: compute prev/next lesson across module boundaries
// ────────────────────────────────────────────────────────────
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
  const next = currentFlatIdx >= 0 && currentFlatIdx < pairs.length - 1 ? pairs[currentFlatIdx + 1] : null;

  return { prev, next };
}

// ────────────────────────────────────────────────────────────
// Normalization: DTO → UI types expected by components
// - Guarantees lesson.videoUrl is a string ("" when missing)
// - Carries `passingScore` through via a safe cast (UI type may not include it).
//   (We no longer use it in the UI, but keeping parity is harmless.)
// ────────────────────────────────────────────────────────────
function normalizeModules(dtoModules: CourseModuleDTO[] | undefined): UICourseModule[] {
  if (!Array.isArray(dtoModules)) return [];
  return dtoModules.map<UICourseModule>((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    lessons: (m.lessons ?? []).map<UICourseLesson>((l) => ({
      id: l.id,
      title: l.title,
      videoUrl: l.videoUrl ?? "", // ✅ force string for UI type
      body: l.body,
      quiz: l.quiz
        ? (({
            questions: l.quiz.questions?.map((q) => ({
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

export default function CoursePage() {
  const router = useRouter();
  const access = usePaidAccess();

  // ────────────────────────────────────────────────────────────
  // 1) Access gate (UNCHANGED)
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (access.loading) return;
    if (!access.hasAccess) {
      router.replace("/dashboard/upgrade");
    }
  }, [access.loading, access.hasAccess, router]);

  // Route: ?slug=... (defaults to your known course)
  const searchParams = useSearchParams();
  const slug = (searchParams?.get("slug") || "cultural-awareness-training").trim();

  // ────────────────────────────────────────────────────────────
  // 2) Course data fetch (after access is true)
  // ────────────────────────────────────────────────────────────
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

  // ────────────────────────────────────────────────────────────
  // 3) Normalized modules for UI components
  // ────────────────────────────────────────────────────────────
  const uiModules: UICourseModule[] = useMemo(
    () => normalizeModules(course?.modules),
    [course?.modules]
  );

  // 4) UI State: current module/lesson + derived lesson + quiz state
  const [currentModuleIndex, setCurrentModuleIndex] = useState<number>(0);
  const [currentLessonIndex, setCurrentLessonIndex] = useState<number>(0);

  // Reset to first lesson when module changes
  useEffect(() => {
    setCurrentLessonIndex(0);
  }, [currentModuleIndex]);

  // Current module/lesson derived safely (from normalized modules)
  const currentModule = useMemo(() => {
    if (!uiModules.length) return null;
    return uiModules[currentModuleIndex] || uiModules[0] || null;
  }, [uiModules, currentModuleIndex]);

  const currentLesson = useMemo(() => {
    if (!currentModule?.lessons?.length) return null;
    return currentModule.lessons[currentLessonIndex] || currentModule.lessons[0] || null;
  }, [currentModule, currentLessonIndex]);

  // Adjacent lesson navigation (prev/next across module boundaries)
  const { prev: prevLesson, next: nextLesson } = useMemo(() => {
    return computeAdjacentLesson(uiModules, currentModuleIndex, currentLessonIndex);
  }, [uiModules, currentModuleIndex, currentLessonIndex]);

  // ────────────────────────────────────────────────────────────
  // 5) Quiz state (pure UI; no persistence)
  // ────────────────────────────────────────────────────────────
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

  const handleQuizSubmit = () => {
    // Reveal correctness feedback
    setRevealed(true);

    // Start a short timer to auto-advance (1.5s)
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = setTimeout(() => {
      // Advance to next lesson if available
      if (nextLesson) {
        setCurrentModuleIndex(nextLesson.m);
        setCurrentLessonIndex(nextLesson.l);
      }
      // else: stay on last lesson (no-op). We intentionally do NOT
      // redirect or change flow to preserve your existing UX.
    }, 1500);
  };

  // Manual navigation buttons still available
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

  // ────────────────────────────────────────────────────────────
  // 6) Render states (UNCHANGED access logic)
  // ────────────────────────────────────────────────────────────
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

  // ────────────────────────────────────────────────────────────
  // 7) Main Layout
  // ────────────────────────────────────────────────────────────
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
              setCurrentModuleIndex(idx);
              setCurrentLessonIndex(0);
            }}
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
                  <p className="text-sm text-gray-500">
                    In module: {currentModule.title}
                  </p>
                )}
              </div>

              {/* Prev/Next lesson controls (manual override) */}
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

            {/* Video (optional; normalized to string) */}
            {currentLesson?.videoUrl && (
              <VideoPlayer
                src={currentLesson.videoUrl}
                title={currentLesson.title}
              />
            )}

            {/* Rich body (Portable Text or string) */}
            {Array.isArray(currentLesson?.body) ? (
              <PortableTextRenderer
                value={currentLesson?.body}
                className="prose prose-blue max-w-none"
              />
            ) : currentLesson?.body ? (
              <div className="prose max-w-none">
                <p>{String(currentLesson.body)}</p>
              </div>
            ) : null}

            {/* Quiz (optional, in-card) */}
            {!!currentLesson?.quiz && (
              <div className="mt-4">
                <QuizCard
                  quiz={currentLesson.quiz}
                  answers={answers}
                  revealed={revealed}
                  onChange={handleQuizChange}
                  onSubmit={handleQuizSubmit}
                />
                {/* No scoring/threshold/feedback text by design */}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

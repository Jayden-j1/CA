// app/dashboard/course/page.tsx
//
// Purpose
// -------
// Render the paid Course experience using your existing components:
//  - <ModuleList /> (sidebar of modules/lessons)
//  - <VideoPlayer /> (lesson video)
//  - <PortableTextRenderer /> (rich text)
//  - <QuizCard /> (per-lesson quiz with reveal + auto-advance)
//
// New in this patch (UX-only, surgical):
// - Adds a "Download Certificate" CTA at the *end of the last lesson*.
//   • If the last lesson has no quiz -> show immediately.
//   • If it has a quiz -> show after the user presses Submit (revealed=true).
// - Calls /api/certificate?courseTitle=<title> to generate the PDF on demand.
//
// Everything else (auth, payments, data fetch, auto-advance after quiz submit)
// remains unchanged from your current working version.

"use client";

import { useEffect, useMemo, useState, useRef } from "react";
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

function computeAdjacentLesson(
  modules: UICourseModule[],
  moduleIndex: number,
  lessonIndex: number
) {
  // Flatten (mIdx, lIdx) pairs for prev/next navigation
  const pairs: Array<{ m: number; l: number }> = [];
  modules.forEach((m, mIdx) => {
    (m.lessons ?? []).forEach((_l, lIdx) => pairs.push({ m: mIdx, l: lIdx }));
  });

  const currentFlatIdx = pairs.findIndex((p) => p.m === moduleIndex && p.l === lessonIndex);
  const prev = currentFlatIdx > 0 ? pairs[currentFlatIdx - 1] : null;
  const next = currentFlatIdx >= 0 && currentFlatIdx < pairs.length - 1 ? pairs[currentFlatIdx + 1] : null;

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

  // Quiz UI state (unchanged)
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [revealed, setRevealed] = useState<boolean>(false);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear quiz state when lesson changes (unchanged)
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
    // Keep your existing reveal + optional auto-advance
    setRevealed(true);
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

  // When a lesson is clicked in the sidebar, display it immediately (unchanged from your latest)
  const handleSelectLesson = (mIdx: number, lIdx: number) => {
    setCurrentModuleIndex(mIdx);
    setCurrentLessonIndex(lIdx);
  };

  // 🔽 NEW: certificate download trigger (fetch → Blob → browser download)
  const downloadCertificate = async () => {
    if (!course?.title) return;
    const res = await fetch(
      `/api/certificate?courseTitle=${encodeURIComponent(course.title)}`,
      { method: "GET", cache: "no-store" }
    );
    if (!res.ok) {
      // Optional: toast error if you use a toaster; silent fail here by design
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Filename fallback; server sends Content-Disposition with a better one
    a.download = `${course.title.replace(/[^\w\-]+/g, "_")}_Certificate.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ✅ CTA appears only at the *final* lesson:
  // - If no quiz: show immediately on the last lesson
  // - If has quiz: show only after user pressed Submit (revealed=true)
  const isLastLesson = !nextLesson; // derived; safe with any length
  const canShowCertificateCTA =
    !!currentLesson && isLastLesson && (!currentLesson.quiz || revealed === true);

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

  // Main UI (unchanged except for the certificate CTA block)
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
            onSelectLesson={handleSelectLesson}
          />
        </div>

        {/* Main content */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl shadow-lg p-5 space-y-5">
            {/* Lesson Title + Nav */}
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

              {/* Prev/Next lesson controls */}
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
              <PortableTextRenderer
                value={currentLesson?.body}
                className="prose prose-blue max-w-none"
              />
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

            {/* ✅ Certificate CTA — only at the *very end* (see canShowCertificateCTA) */}
            {canShowCertificateCTA && (
              <div className="mt-6 p-4 border rounded-lg bg-emerald-50 border-emerald-300">
                <p className="text-emerald-900 font-medium mb-3">
                   You’ve reached the end of the course.
                </p>
                <button
                  onClick={downloadCertificate}
                  className="inline-flex items-center px-4 py-2 rounded-lg font-semibold
                             bg-emerald-600 hover:bg-emerald-500 text-white shadow"
                >
                  Download Certificate (PDF)
                </button>
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
// // Render the paid Course experience using your existing components:
// //  - <ModuleList /> (sidebar of modules/lessons)
// //  - <VideoPlayer /> (lesson video)
// //  - <PortableTextRenderer /> (rich text)
// //  - <QuizCard /> (per-lesson quiz with reveal + auto-advance)
// //
// // New in this patch (UX-only):
// // - Wires ModuleList.onSelectLesson(mIdx, lIdx) to update local state so a
// //   clicked lesson displays immediately.
// //
// // Everything else (auth, payments, data fetch, auto-advance after quiz submit)
// // remains unchanged from your current working version.

// "use client";

// import { useEffect, useMemo, useState, useRef } from "react";
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

// // DTOs matching /api/courses/[slug]
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
//   const next = currentFlatIdx >= 0 && currentFlatIdx < pairs.length - 1 ? pairs[currentFlatIdx + 1] : null;

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
//             questions: l.quiz.questions?.map((q) => ({
//               id: q.id,
//               question: q.question,
//               options: q.options,
//               correctIndex: q.correctIndex,
//             })) ?? [],
//             passingScore: l.quiz.passingScore,
//           } as any) as UICourseQuiz)
//         : undefined,
//     })),
//   }));
// }

// export default function CoursePage() {
//   const router = useRouter();
//   const access = usePaidAccess();

//   // Access gate (unchanged)
//   useEffect(() => {
//     if (access.loading) return;
//     if (!access.hasAccess) {
//       router.replace("/dashboard/upgrade");
//     }
//   }, [access.loading, access.hasAccess, router]);

//   const searchParams = useSearchParams();
//   const slug = (searchParams?.get("slug") || "cultural-awareness-training").trim();

//   // Fetch course (unchanged)
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
//         if (!res.ok) {
//           throw new Error(data?.error || "Failed to load course");
//         }
//         if (!cancelled) {
//           setCourse(data.course as CourseDTO);
//         }
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

//   // Normalize for UI
//   const uiModules: UICourseModule[] = useMemo(
//     () => normalizeModules(course?.modules),
//     [course?.modules]
//   );

//   // Current indices + derived current lesson
//   const [currentModuleIndex, setCurrentModuleIndex] = useState<number>(0);
//   const [currentLessonIndex, setCurrentLessonIndex] = useState<number>(0);

//   // When module changes, reset to first lesson (unchanged)
//   useEffect(() => {
//     setCurrentLessonIndex(0);
//   }, [currentModuleIndex]);

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

//   // Quiz UI state (unchanged)
//   const [answers, setAnswers] = useState<QuizAnswers>({});
//   const [revealed, setRevealed] = useState<boolean>(false);
//   const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

//   // Clear quiz state when lesson changes
//   useEffect(() => {
//     setAnswers({});
//     setRevealed(false);
//     if (autoAdvanceTimer.current) {
//       clearTimeout(autoAdvanceTimer.current);
//       autoAdvanceTimer.current = null;
//     }
//   }, [currentLesson?.id]);

//   const handleQuizChange = (questionId: string, optionIndex: number) => {
//     setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
//   };

//   const handleQuizSubmit = () => {
//     setRevealed(true);
//     if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
//     autoAdvanceTimer.current = setTimeout(() => {
//       if (nextLesson) {
//         setCurrentModuleIndex(nextLesson.m);
//         setCurrentLessonIndex(nextLesson.l);
//       }
//     }, 1500);
//   };

//   // Manual navigation
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

//   // ✅ NEW: when a lesson is clicked in the sidebar, display it immediately.
//   const handleSelectLesson = (mIdx: number, lIdx: number) => {
//     setCurrentModuleIndex(mIdx);
//     setCurrentLessonIndex(lIdx);
//   };

//   // Render states (unchanged)
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

//   // Main UI (unchanged except passing `onSelectLesson`)
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
//               setCurrentModuleIndex(idx);
//               setCurrentLessonIndex(0);
//             }}
//             onSelectLesson={handleSelectLesson} // ✅ NEW
//           />
//         </div>

//         {/* Main content */}
//         <div className="lg:col-span-8">
//           <div className="bg-white rounded-2xl shadow-lg p-5 space-y-5">
//             {/* Lesson Title */}
//             <div className="flex items-center justify-between">
//               <div>
//                 <h2 className="text-2xl font-bold text-blue-900">
//                   {currentLesson?.title || "Lesson"}
//                 </h2>
//                 {currentModule?.title && (
//                   <p className="text-sm text-gray-500">
//                     In module: {currentModule.title}
//                   </p>
//                 )}
//               </div>

//               {/* Prev/Next lesson controls */}
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
//               <VideoPlayer
//                 src={currentLesson.videoUrl}
//                 title={currentLesson.title}
//               />
//             )}

//             {/* Rich body */}
//             {Array.isArray(currentLesson?.body) ? (
//               <PortableTextRenderer
//                 value={currentLesson?.body}
//                 className="prose prose-blue max-w-none"
//               />
//             ) : currentLesson?.body ? (
//               <div className="prose max-w-none">
//                 <p>{String(currentLesson.body)}</p>
//               </div>
//             ) : null}

//             {/* Quiz (optional) */}
//             {!!currentLesson?.quiz && (
//               <div className="mt-4">
//                 <QuizCard
//                   quiz={currentLesson.quiz}
//                   answers={answers}
//                   revealed={revealed}
//                   onChange={handleQuizChange}
//                   onSubmit={handleQuizSubmit}
//                 />
//                 {/* No scoring text by design */}
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </section>
//   );
// }

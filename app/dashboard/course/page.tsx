// app/dashboard/course/page.tsx
//
// Phase 1+ scaffolding (API-aware):
// - Handles course access gating, data fetching, local progress, and rendering.
// - Uses /api/payments/check, /api/courses, /api/courses/[slug], and /api/courses/progress.
// - Ensures all React hooks are declared before any conditional return (avoids invalid hook order).
//
// Phase 2.3 addition:
// - Adds a “🎓 Download Certificate” button that appears ONLY when progressPercent === 100.
// - Button calls /api/courses/certificate and triggers a PDF download in-browser.
//
// Pillars of implementation:
// - ✅ Efficiency: minimal network requests, debounced saves, cached progress.
// - ✅ Robustness: defensive clamping of indices, fallback data, try/catch on network ops.
// - ✅ Simplicity: each function does one thing.
// - ✅ Security: avoids client file writes, validates access before actions.
// - ✅ Ease of management: modular design consistent with app standards.

"use client";

import { Suspense } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

import FullPageSpinner from "@/components/ui/fullPageSpinner";
import ModuleList from "@/components/course/ModuleList";
import VideoPlayer from "@/components/course/VideoPlayer";
import QuizCard from "@/components/course/QuizCard";
import type { CourseDetail, CourseModule } from "@/types/course";

// --------------------------------------------------------
//  Access check response type
// --------------------------------------------------------
interface PaymentCheckResponse {
  hasAccess: boolean;
  packageType: "individual" | "business" | null;
  latestPayment: {
    id: string;
    createdAt: string;
    amount: number;
  } | null;
}

// --------------------------------------------------------
// Local placeholder course (used when API unavailable)
// --------------------------------------------------------
const LOCAL_PLACEHOLDER: CourseDetail = {
  id: "local",
  slug: "local-placeholder",
  title: "Cultural Awareness (Placeholder)",
  summary: "Introductory modules for Phase 1 demo.",
  coverImage: null,
  modules: [
    {
      id: "m1",
      title: "Introduction to Country & Connection",
      description:
        "Foundations of Country as identity, law, and responsibility.",
      lessons: [
        {
          id: "m1l1",
          title: "Country & Identity",
          videoUrl: "https://example.com/video1.mp4",
          body:
            "Explore how Country shapes identity, law, and responsibility. Learn why connection to land, water, and skies matters.",
        },
        {
          id: "m1l2",
          title: "Deep Listening",
          videoUrl: "https://example.com/video1b.mp4",
          body:
            "Learn about yarning and deep listening—listening with the heart, not just the ears.",
          quiz: {
            questions: [
              {
                id: "m1q1",
                question: "Country is best understood as…",
                options: [
                  "Just a physical place",
                  "Identity, law, and responsibility",
                  "A political boundary",
                  "A modern concept only",
                ],
                correctIndex: 1,
              },
            ],
          },
        },
      ],
    },
  ],
};

// --------------------------------------------------------
// Suspense wrapper (clean loading fallback)
// --------------------------------------------------------
export default function CoursePageWrapper() {
  return (
    <Suspense
      fallback={
        <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
          <p className="text-white text-xl">Loading course…</p>
        </section>
      }
    >
      <CoursePageInner />
    </Suspense>
  );
}

// --------------------------------------------------------
// Main Course Page (core logic)
// --------------------------------------------------------
function CoursePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const justSucceeded = searchParams.get("success") === "true";

  // ---------------- Access control state ----------------
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [packageType, setPackageType] =
    useState<"individual" | "business" | null>(null);
  const [latestPayment, setLatestPayment] =
    useState<PaymentCheckResponse["latestPayment"]>(null);
  const didRedirect = useRef(false);

  // ---------------- Course data ----------------
  const [course, setCourse] = useState<CourseDetail | null>(null);

  // ---------------- Progress state ----------------
  type Persisted = {
    currentModuleIndex: number;
    currentLessonIndex: number;
    answers: Record<string, number | null>;
  };
  const STORAGE_KEY = "course:progress:v1";

  // Bootstrap progress from localStorage
  const initialProgress: Persisted = useMemo(() => {
    try {
      const raw =
        typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted;
        return {
          currentModuleIndex: Math.max(parsed.currentModuleIndex ?? 0, 0),
          currentLessonIndex: Math.max(parsed.currentLessonIndex ?? 0, 0),
          answers: parsed.answers ?? {},
        };
      }
    } catch {
      /* ignore parse errors */
    }
    return { currentModuleIndex: 0, currentLessonIndex: 0, answers: {} };
  }, []);

  const [currentModuleIndex, setCurrentModuleIndex] = useState<number>(
    initialProgress.currentModuleIndex
  );
  const [currentLessonIndex, setCurrentLessonIndex] = useState<number>(
    initialProgress.currentLessonIndex
  );
  const [answers, setAnswers] = useState<Record<string, number | null>>(
    initialProgress.answers
  );

  // Debounced save timer
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");

  // --------------------------------------------------------
  // Access verification via /api/payments/check
  // --------------------------------------------------------
  useEffect(() => {
    const ac = new AbortController();
    const checkOnce = async () => {
      const res = await fetch("/api/payments/check", {
        signal: ac.signal,
        cache: "no-store",
      });
      const data: PaymentCheckResponse = await res.json();
      return { ok: res.ok, data };
    };

    const run = async () => {
      if (status === "loading") return;

      try {
        // Optimistic unlock if session says user has paid
        if (session?.user?.hasPaid) setHasAccess(true);

        // Authoritative backend check
        const first = await checkOnce();
        if (first.ok && first.data.hasAccess) {
          setHasAccess(true);
          setPackageType(first.data.packageType);
          setLatestPayment(first.data.latestPayment);
        } else if (justSucceeded) {
          // Retry short polling if just paid
          const maxAttempts = 8;
          const delayMs = 1500;
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise((r) => setTimeout(r, delayMs));
            const retry = await checkOnce();
            if (retry.ok && retry.data.hasAccess) {
              setHasAccess(true);
              setPackageType(retry.data.packageType);
              setLatestPayment(retry.data.latestPayment);
              break;
            }
          }
        }

        // Redirect if no access
        if (!hasAccess && !session?.user?.hasPaid && !didRedirect.current) {
          didRedirect.current = true;
          router.push("/dashboard/upgrade");
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[Course] Access check failed:", err);
          if (!didRedirect.current) {
            didRedirect.current = true;
            router.push("/dashboard/upgrade");
          }
        }
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => ac.abort();
  }, [status, session?.user?.hasPaid, router, justSucceeded, hasAccess]);

  // --------------------------------------------------------
  // Load course list and detail (API-first, fallback to local)
  // --------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const listRes = await fetch("/api/courses", { cache: "no-store" });
        const listJson = await listRes.json();
        const first = Array.isArray(listJson?.courses) ? listJson.courses[0] : null;

        if (!first?.slug) {
          if (!cancelled) setCourse(LOCAL_PLACEHOLDER);
          return;
        }

        const detailRes = await fetch(`/api/courses/${first.slug}`, {
          cache: "no-store",
        });
        if (!detailRes.ok) {
          if (!cancelled) setCourse(LOCAL_PLACEHOLDER);
          return;
        }
        const detailJson = await detailRes.json();
        if (!cancelled) setCourse(detailJson.course as CourseDetail);
      } catch (err) {
        console.warn("[Course] Could not load course, fallback to local:", err);
        if (!cancelled) setCourse(LOCAL_PLACEHOLDER);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // --------------------------------------------------------
  // Load saved progress from backend (if available)
  // --------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const loadProgress = async () => {
      if (!course) return;
      try {
        const res = await fetch(
          `/api/courses/progress?courseId=${encodeURIComponent(course.id)}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const json = await res.json();
          if (json?.progress && !cancelled) {
            const modules = course.modules ?? [];
            const cm = Math.min(
              Math.max(json.progress.currentModuleIndex ?? 0, 0),
              Math.max(modules.length - 1, 0)
            );
            const lessons = modules[cm]?.lessons ?? [];
            const cl = Math.min(
              Math.max(json.progress.currentLessonIndex ?? 0, 0),
              Math.max(lessons.length - 1, 0)
            );
            setCurrentModuleIndex(cm);
            setCurrentLessonIndex(cl);
            setAnswers(json.progress.answers ?? {});
          }
        }
      } catch {
        /* non-fatal */
      }
    };
    loadProgress();
    return () => {
      cancelled = true;
    };
  }, [course?.id]);

  // --------------------------------------------------------
  // Persist progress (localStorage + debounced server post)
  // --------------------------------------------------------
  useEffect(() => {
    const payload: Persisted = { currentModuleIndex, currentLessonIndex, answers };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }

    if (course && course.id !== "local") {
      const key = JSON.stringify([course.id, currentModuleIndex, currentLessonIndex, answers]);
      if (key === lastSaved.current) return;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await fetch("/api/courses/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              courseId: course.id,
              currentModuleIndex,
              currentLessonIndex,
              answers,
            }),
          });
          lastSaved.current = key;
        } catch {
          /* ignore transient errors */
        }
      }, 800);
    }

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [course, currentModuleIndex, currentLessonIndex, answers]);

  // --------------------------------------------------------
  // Early returns — no hooks after this point
  // --------------------------------------------------------
  if (loading) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">
          {justSucceeded ? "Finalizing your payment..." : "Checking course access..."}
        </p>
      </section>
    );
  }
  if (!hasAccess) return null;
  if (!course) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Preparing your course…</p>
      </section>
    );
  }

  // --------------------------------------------------------
  // Derived helpers (safe area)
  // --------------------------------------------------------
  const modules: CourseModule[] = course.modules ?? [];
  const currentModule = modules[currentModuleIndex] ?? modules[0];
  const currentLesson =
    currentModule?.lessons[currentLessonIndex] ?? currentModule?.lessons?.[0];

  const goNextLesson = () => {
    const lessons = currentModule?.lessons ?? [];
    const last = lessons.length - 1; // ✅ fixed typo (aconst → const)
    if (currentLessonIndex < last) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    } else if (currentModuleIndex < modules.length - 1) {
      setCurrentModuleIndex(currentModuleIndex + 1);
      setCurrentLessonIndex(0);
    }
  };

  const goPrevLesson = () => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex(currentLessonIndex - 1);
    } else if (currentModuleIndex > 0) {
      const prevModuleIndex = currentModuleIndex - 1;
      setCurrentModuleIndex(prevModuleIndex);
      const prevLessons = modules[prevModuleIndex]?.lessons ?? [];
      setCurrentLessonIndex(Math.max(prevLessons.length - 1, 0));
    }
  };

  const handleQuizChange = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleQuizSubmit = () => {
    console.log("Quiz answers:", answers);
    goNextLesson();
  };

  // --------------------------------------------------------
  // Simple computed progress
  // --------------------------------------------------------
  const flatLessonCount = modules.reduce(
    (acc, m) => acc + (m.lessons?.length ?? 0),
    0
  );
  let currentFlatIndex = 0;
  for (let m = 0; m < modules.length; m++) {
    if (m < currentModuleIndex) {
      currentFlatIndex += modules[m].lessons?.length ?? 0;
    }
  }
  currentFlatIndex += currentLessonIndex;
  const progressPercent =
    flatLessonCount > 0
      ? Math.round(((currentFlatIndex + 1) / flatLessonCount) * 100)
      : 0;

  // --------------------------------------------------------
  // Render layout
  // --------------------------------------------------------
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-10 sm:py-12 lg:py-16">
      <div className="mx-auto w-[92%] max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-white font-extrabold text-3xl sm:text-4xl tracking-tight">
              {course.title}
            </h1>
            {course.summary && (
              <p className="text-blue-100 mt-1">{course.summary}</p>
            )}
            {packageType && latestPayment && (
              <p className="text-blue-100 mt-1">
                Package: <span className="font-semibold capitalize">{packageType}</span>
                {" • Last purchase: "}
                <span className="font-semibold">${latestPayment.amount}</span>{" "}
                on {new Date(latestPayment.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="inline-flex items-center gap-2 bg-white/90 text-blue-900 font-semibold px-3 py-1.5 rounded-lg shadow">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
            {progressPercent}% complete
          </div>
        </div>

        {/* Course Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4">
            <ModuleList
              modules={modules}
              currentModuleIndex={currentModuleIndex}
              currentLessonIndex={currentLessonIndex}
              onSelectModule={(m) => {
                setCurrentModuleIndex(m);
                setCurrentLessonIndex(0);
              }}
            />
          </div>

          <div className="lg:col-span-8">
            <div className="h-full w-full bg-white/95 rounded-2xl shadow-lg p-5 sm:p-6 space-y-5">
              {/* Lesson Header + Nav */}
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-blue-900">
                    {currentModule?.title ?? "Module"}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {currentLesson?.title ?? "Lesson"}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={goPrevLesson}
                    className="px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-semibold"
                  >
                    ◀ Previous
                  </button>
                  <button
                    onClick={goNextLesson}
                    className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow"
                  >
                    Next ▶
                  </button>
                </div>
              </div>

              {/* Video Section */}
              {currentLesson?.videoUrl ? (
                <VideoPlayer
                  src={currentLesson.videoUrl}
                  title={`${currentModule?.title ?? ""} — ${currentLesson?.title ?? ""}`}
                />
              ) : (
                <div className="w-full aspect-video bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                  <p className="text-gray-500">No video for this lesson.</p>
                </div>
              )}

              {/* Lesson Body */}
              {currentLesson?.body && (
                <div className="prose prose-blue max-w-none">
                  <p className="text-gray-800 leading-relaxed">{currentLesson.body}</p>
                </div>
              )}

              {/* Quiz Section */}
              {currentLesson?.quiz && (
                <QuizCard
                  quiz={currentLesson.quiz}
                  answers={answers}
                  onChange={handleQuizChange}
                  onSubmit={handleQuizSubmit}
                />
              )}

              {/* 🎓 Certificate Download — shown only when 100% complete */}
              {progressPercent === 100 && (
                <div className="pt-3 mt-2 border-t border-gray-200">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/courses/certificate");
                        if (!res.ok) {
                          const msg = await res.json().catch(() => null);
                          alert(
                            msg?.error ??
                              "Unable to generate certificate. Please try again."
                          );
                          return;
                        }
                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "certificate.pdf";
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                      } catch (e) {
                        console.error("[Certificate download] error:", e);
                        alert("Something went wrong generating your certificate.");
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg font-semibold
                               bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-transform hover:scale-[1.02]"
                    aria-label="Download certificate of completion"
                  >
                    <span role="img" aria-label="graduation cap">🎓</span>
                    Download Certificate
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

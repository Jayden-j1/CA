// app/dashboard/course/page.tsx
//
// Phase 1+ scaffolding (API-aware):
// - Gated by /api/payments/check (unchanged).
// - Loads first published course from /api/courses, then its detail from /api/courses/[slug].
// - Loads/saves user progress via /api/courses/progress (with localStorage fallback).
// - Clean, responsive UI with a module list and a player/quiz panel.
//
// Robustness:
// - All stateful hooks are declared before any conditional return.
// - IMPORTANT FIX: Removed late useMemo hooks that executed only after data loads,
//   which previously changed the hook order across renders and triggered React's error.
// - API failures gracefully fall back to local placeholder + localStorage.
// - Defensive clamping of indices to avoid out-of-bound errors.
//
// Phase 2.3 addition (already present):
// - Adds a “🎓 Download Certificate” button that appears ONLY when progressPercent === 100.
// - Button fetches /api/courses/certificate and downloads a generated PDF.
//
// Phase 3.1 (Feedback & Motion Enhancements):
// - Smooth, animated progress bar (no extra library).
// - One-time "Course complete 🎉" banner when learner first reaches 100%.
// - Gentle pulse animation on the certificate button when it first appears.
// - Small, accessible inline success/error messaging for certificate downloads.
// - All enhancements are frontend-only, lightweight, and dependency-free.

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

// ------------------------------
// Access check types (unchanged)
// ------------------------------
interface PaymentCheckResponse {
  hasAccess: boolean;
  packageType: "individual" | "business" | null;
  latestPayment: {
    id: string;
    createdAt: string;
    amount: number;
  } | null;
}

// ------------------------------
// Local placeholder course (used only if API data unavailable)
// ------------------------------
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

// ------------------------------
// Suspense wrapper
// ------------------------------
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

// ------------------------------
// Main page (all hooks declared before returns)
// ------------------------------
function CoursePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const justSucceeded = searchParams.get("success") === "true";

  // ---------------- Access & page state ----------------
  // NOTE: These states must be declared before any conditional return.
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [packageType, setPackageType] =
    useState<"individual" | "business" | null>(null);
  const [latestPayment, setLatestPayment] =
    useState<PaymentCheckResponse["latestPayment"]>(null);
  const didRedirect = useRef(false);

  // ---------------- Course data ----------------
  // Try API first; fallback to local placeholder.
  const [course, setCourse] = useState<CourseDetail | null>(null);

  // ---------------- Progress state ----------------
  // Indices + answers + localStorage key:
  type Persisted = {
    currentModuleIndex: number;
    currentLessonIndex: number;
    answers: Record<string, number | null>;
  };
  const STORAGE_KEY = "course:progress:v1";

  // Single read to bootstrap from localStorage (safe to useMemo here—it's before any return)
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
      // ignore parse errors
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

  // Debounced server save (for progress)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");

  // ---------------- Phase 3.1 UX state (no new deps) ----------------
  // - showCompleteBanner: transient celebratory banner the *first time* the user hits 100%.
  // - pulseCertButton: one-time gentle pulse for the certificate button when it appears.
  // - certMessage: small accessible inline status for success/error on certificate actions.
  const [showCompleteBanner, setShowCompleteBanner] = useState(false);
  const celebratedOnceRef = useRef(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pulseCertButton, setPulseCertButton] = useState(false);
  const [certMessage, setCertMessage] = useState<string | null>(null);

  // -------------------------------------------
  // Access gate (authoritative)
  // -------------------------------------------
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
        // Optimistic unlock if session claims paid.
        if (session?.user?.hasPaid) {
          setHasAccess(true);
        }

        // Authoritative check
        const first = await checkOnce();
        if (first.ok && first.data.hasAccess) {
          setHasAccess(true);
          setPackageType(first.data.packageType);
          setLatestPayment(first.data.latestPayment);
        } else if (justSucceeded) {
          // Short poll for webhook landing
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

        // If still no access → redirect
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.hasPaid, router, justSucceeded]);

  // -------------------------------------------
  // Load course via API (first published) → detail
  // Fallback to LOCAL_PLACEHOLDER on error/empty
  // -------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // 1) list published courses
        const listRes = await fetch("/api/courses", { cache: "no-store" });
        const listJson = await listRes.json();
        const first = Array.isArray(listJson?.courses) ? listJson.courses[0] : null;

        if (!first?.slug) {
          // fallback
          if (!cancelled) setCourse(LOCAL_PLACEHOLDER);
          return;
        }

        // 2) fetch detail by slug
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
        console.warn("[Course] Could not load course from API, using fallback:", err);
        if (!cancelled) setCourse(LOCAL_PLACEHOLDER);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------
  // Load server progress (if course loaded)
  // -------------------------------------------
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
            // Clamp indices to course shape
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
        // Non-fatal: localStorage fallback already initialized
      }
    };

    loadProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id]);

  // -------------------------------------------
  // Persist progress
  // - Always keep localStorage in sync (fast).
  // - Attempt debounced server save if course is from API (has real id).
  // -------------------------------------------
  useEffect(() => {
    // Save to localStorage first (never fails the UX)
    const payload: Persisted = { currentModuleIndex, currentLessonIndex, answers };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota issues
    }

    // If we have a real API course, post progress (debounced)
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
          // network hiccups are fine; localStorage still has state
        }
      }, 800);
    }

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [course, currentModuleIndex, currentLessonIndex, answers]);

  // -------------------------------------------
  // Phase 3.1: Watch for "first time at 100%" to show banner + button pulse
  // NOTE:
  // - This effect computes completion from known indices + course shape.
  // - We do NOT rely on any derived variables declared *after* the early returns.
  // - This keeps all hooks safely declared above.
  // -------------------------------------------
  useEffect(() => {
    if (!course) return;

    // Compute total lessons
    const modules = course.modules ?? [];
    const totalLessons = modules.reduce(
      (acc, m) => acc + (m?.lessons?.length ?? 0),
      0
    );

    if (totalLessons === 0) return;

    // Compute "current flat index" (0-based) + seen lessons count
    let seen = 0;
    for (let m = 0; m < modules.length; m++) {
      if (m < currentModuleIndex) {
        seen += modules[m].lessons?.length ?? 0;
      }
    }
    seen += currentLessonIndex + 1; // +1 → because current lesson is also "seen"

    const nowComplete = seen >= totalLessons;
    if (nowComplete && !celebratedOnceRef.current) {
      // First time completion detected → show banner + pulse the certificate button
      celebratedOnceRef.current = true;
      setShowCompleteBanner(true);
      setPulseCertButton(true);

      // Auto-hide the banner after a few seconds; keep the button available.
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = setTimeout(() => {
        setShowCompleteBanner(false);
      }, 4500);

      // Stop the pulse after a short moment so it doesn't distract
      setTimeout(() => setPulseCertButton(false), 2500);
    }

    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [course, currentModuleIndex, currentLessonIndex]);

  // -------------------------------------------
  // Early returns AFTER all state/effect hooks are declared
  // (No hooks appear below that can be skipped conditionally.)
  // -------------------------------------------
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
    // very brief state while fallback resolves
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Preparing your course…</p>
      </section>
    );
  }

  // -------------------------------------------
  // Derived data + helpers (SAFE: No Hooks below this point)
  // -------------------------------------------
  const modules: CourseModule[] = course.modules ?? [];
  const currentModule = modules[currentModuleIndex] ?? modules[0];
  const currentLesson =
    currentModule?.lessons[currentLessonIndex] ??
    currentModule?.lessons?.[0];

  const clampToCourse = (mIdx: number, lIdx: number) => {
    const m = Math.min(Math.max(mIdx, 0), Math.max(modules.length - 1, 0));
    const lessons = modules[m]?.lessons ?? [];
    const l = Math.min(Math.max(lIdx, 0), Math.max(lessons.length - 1, 0));
    return [m, l] as const;
  };

  const goToModule = (mIdx: number) => {
    const [m] = clampToCourse(mIdx, 0);
    setCurrentModuleIndex(m);
    setCurrentLessonIndex(0);
  };

  const goNextLesson = () => {
    const lessons = currentModule?.lessons ?? [];
    const last = lessons.length - 1;
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
    // Phase 1: no grading UI yet; advance
    console.log("Quiz answers:", answers);
    goNextLesson();
  };

  // ---------- Simple overall progress (NO HOOKS here) ----------
  // We intentionally compute these *without* useMemo so hook order never changes.
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

  const isComplete = progressPercent >= 100;

  // -------------------------------------------
  // Helper: certificate download (with small UX message)
  // -------------------------------------------
  const downloadCertificate = async () => {
    setCertMessage(null);
    try {
      const res = await fetch("/api/courses/certificate");
      if (!res.ok) {
        // UX: Provide a small reason if backend denies (e.g., not 100% yet)
        const msg = await res.json().catch(() => null);
        setCertMessage(
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
      setCertMessage("🎉 Certificate downloaded successfully.");
    } catch (e) {
      console.error("[Certificate download] error:", e);
      setCertMessage("Something went wrong generating your certificate.");
    }
  };

  // -------------------------------------------
  // Render
  // -------------------------------------------
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

          {/* Compact progress chip (unchanged) */}
          <div className="inline-flex items-center gap-2 bg-white/90 text-blue-900 font-semibold px-3 py-1.5 rounded-lg shadow">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
            {progressPercent}% complete
          </div>
        </div>

        {/* NEW (Phase 3.1): Animated progress bar (no deps) */}
        {/* - The inner bar width animates smoothly via CSS transition.
            - The label is visually accessible; the bar has aria props for SR. */}
        <div className="mb-6">
          <div
            className="h-3 w-full rounded-full bg-white/40 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-label="Course progress"
            title={`Progress: ${progressPercent}%`}
          >
            <div
              className="h-full bg-emerald-400"
              // Smoothly animate width changes
              style={{
                width: `${progressPercent}%`,
                transition: "width 450ms ease",
              }}
            />
          </div>
        </div>

        {/* One-time celebratory banner (Phase 3.1) */}
        {showCompleteBanner && (
          <div
            role="status"
            aria-live="polite"
            className="
              mb-6 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900
              px-4 py-3 shadow-sm
              transition-opacity duration-500
            "
          >
            <p className="font-semibold">🎉 Course complete!</p>
            <p className="text-sm">
              Great work. You can now download your certificate below.
            </p>
          </div>
        )}

        {/* 2-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4">
            <ModuleList
              modules={modules}
              currentModuleIndex={currentModuleIndex}
              currentLessonIndex={currentLessonIndex}
              onSelectModule={goToModule}
            />
          </div>

          <div className="lg:col-span-8">
            <div className="h-full w-full bg-white/95 rounded-2xl shadow-lg p-5 sm:p-6 space-y-5">
              {/* Lesson header + nav */}
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
                    className="px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-semibold transition-transform hover:scale-[1.01]"
                  >
                    ◀ Previous
                  </button>
                  <button
                    onClick={goNextLesson}
                    className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow transition-transform hover:scale-[1.02]"
                  >
                    Next ▶
                  </button>
                </div>
              </div>

              {/* Video */}
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

              {/* Body */}
              {currentLesson?.body && (
                <div className="prose prose-blue max-w-none">
                  <p className="text-gray-800 leading-relaxed">{currentLesson.body}</p>
                </div>
              )}

              {/* Quiz */}
              {currentLesson?.quiz && (
                <QuizCard
                  quiz={currentLesson.quiz}
                  answers={answers}
                  onChange={handleQuizChange}
                  onSubmit={handleQuizSubmit}
                />
              )}

              {/* --------------------------------------------
                  🎓 Certificate download (Phase 2.3 + 3.1 polish)
                  - Only render when user has completed 100% of lessons.
                  - Button gets a one-time "pulse" when it first appears.
                  - Inline accessible status message shows after action.
                 -------------------------------------------- */}
              {isComplete && (
                <div className="pt-3 mt-2 border-t border-gray-200">
                  <button
                    onClick={downloadCertificate}
                    className={[
                      "inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg font-semibold",
                      "bg-emerald-600 hover:bg-emerald-500 text-white shadow",
                      "transition-transform hover:scale-[1.02]",
                      // One-time gentle pulse the first time the button becomes available
                      pulseCertButton ? "animate-pulse" : "",
                    ].join(" ")}
                    aria-label="Download certificate of completion"
                    aria-live="polite"
                  >
                    <span role="img" aria-label="graduation cap">🎓</span>
                    Download Certificate
                  </button>

                  {/* Small inline status (success/error) for accessibility and clarity */}
                  {certMessage && (
                    <p className="mt-2 text-sm text-gray-700" role="status" aria-live="polite">
                      {certMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

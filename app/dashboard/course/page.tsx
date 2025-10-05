// app/dashboard/course/page.tsx
//
// ============================================================
// Phase History
// ------------------------------------------------------------
// • Phase 1.0  : Core course UX (modules, lessons, quiz placeholders)
// • Phase 2.1  : /api/courses & /api/courses/[slug] robust read-only DTO
// • Phase 2.2  : Progress persistence (localStorage + API)
// • Phase 2.3  : 🎓 Certificate download when 100% complete
// • Phase 3.1  : Feedback & motion enhancements (accessibility-safe)
// • Phase 3.2  : Navigation polish (sticky header, arrow keys, bounds)
// • Phase 3.3  : Lesson transitions + micro-interactions (Framer Motion)
// • Phase 4.0  : Final polish (import order, useCallback, comments)
// ============================================================
//
// Purpose
// -------
// Smooth, distraction-free course experience:
//
// - Sticky header: context always visible
// - Robust access gating with graceful fallbacks
// - Keyboard navigation: ← / →
// - Subtle motion for lesson transitions (Framer Motion)
// - “Download Certificate” appears only at 100% completion
//
// Pillars
// -------
// - Simplicity: self-contained enhancements; no new global state
// - Robustness: hook order preserved; defensive guards; stable closures
// - Efficiency: GPU-accelerated transforms; lightweight render
// - Ease of management: heavily commented; clear sections
// - Security: read-only course consumption; no elevated privileges
// ============================================================

"use client";

// -------------------------
// React & Next core imports
// -------------------------
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

// -------------------------
// Third-party (motion)
// -------------------------
import { motion, AnimatePresence } from "framer-motion";

// -------------------------
// Internal components & types
// -------------------------
import ModuleList from "@/components/course/ModuleList";
import VideoPlayer from "@/components/course/VideoPlayer";
import QuizCard from "@/components/course/QuizCard";
import type { CourseDetail, CourseModule } from "@/types/course";

// ------------------------------------------------------------
// Access check response type
// ------------------------------------------------------------
interface PaymentCheckResponse {
  hasAccess: boolean;
  packageType: "individual" | "business" | null;
  latestPayment: { id: string; createdAt: string; amount: number } | null;
}

// ------------------------------------------------------------
// Local fallback course (used only when API fails or empty)
// - Keeps the UI resilient during initial integration/testing
// ------------------------------------------------------------
const LOCAL_PLACEHOLDER: CourseDetail = {
  id: "local",
  slug: "local-placeholder",
  title: "Cultural Awareness (Placeholder)",
  summary: "Introductory modules for demo purposes.",
  coverImage: null,
  modules: [
    {
      id: "m1",
      title: "Introduction to Country & Connection",
      description: "Foundations of Country as identity, law, and responsibility.",
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

// ------------------------------------------------------------
// Suspense wrapper — isolates loading shell for App Router
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Main Course Page Component
// ------------------------------------------------------------
function CoursePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  // Whether we just returned from a checkout success (to allow brief repolling)
  const justSucceeded = searchParams.get("success") === "true";

  // ---------- Access & Course State ----------
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [packageType, setPackageType] =
    useState<"individual" | "business" | null>(null);
  const [latestPayment, setLatestPayment] =
    useState<PaymentCheckResponse["latestPayment"]>(null);
  const didRedirect = useRef(false);

  // Course DTO loaded from /api/courses + /api/courses/[slug]
  const [course, setCourse] = useState<CourseDetail | null>(null);

  // ---------- Progress (locally persisted) ----------
  // Stored shape that mirrors server API payload
  type Persisted = {
    currentModuleIndex: number;
    currentLessonIndex: number;
    answers: Record<string, number | null>;
  };
  const STORAGE_KEY = "course:progress:v1";

  // Bootstrap from localStorage once (safe in useMemo at top level)
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
      // If JSON parsing fails, fall back to defaults gracefully
    }
    return { currentModuleIndex: 0, currentLessonIndex: 0, answers: {} };
  }, []);

  // Client state derived from persisted values
  const [currentModuleIndex, setCurrentModuleIndex] = useState(
    initialProgress.currentModuleIndex
  );
  const [currentLessonIndex, setCurrentLessonIndex] = useState(
    initialProgress.currentLessonIndex
  );
  const [answers, setAnswers] = useState<Record<string, number | null>>(
    initialProgress.answers
  );

  // ------------------------------------------------------------
  // Authoritative Access Check — defensively fetches once and repolls briefly
  // ------------------------------------------------------------
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
      // Wait until session is settled to avoid flicker
      if (status === "loading") return;

      try {
        // Optimistic unlock to reduce perceived latency (authoritative check still follows)
        if (session?.user?.hasPaid) setHasAccess(true);

        const first = await checkOnce();
        if (first.ok && first.data.hasAccess) {
          setHasAccess(true);
          setPackageType(first.data.packageType);
          setLatestPayment(first.data.latestPayment);
        } else if (justSucceeded) {
          // If returning from payment, repoll briefly for Stripe webhook propagation
          for (let i = 0; i < 8; i++) {
            await new Promise((r) => setTimeout(r, 1500));
            const retry = await checkOnce();
            if (retry.ok && retry.data.hasAccess) {
              setHasAccess(true);
              setPackageType(retry.data.packageType);
              setLatestPayment(retry.data.latestPayment);
              break;
            }
          }
        }

        // Still no access? Redirect out of the course screen.
        if (!hasAccess && !session?.user?.hasPaid && !didRedirect.current) {
          didRedirect.current = true;
          router.push("/dashboard/upgrade");
        }
      } catch (err) {
        // AbortError is normal on unmount; anything else we treat as a failure
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
    // NOTE: dependencies deliberately minimal to avoid unnecessary reruns
  }, [status, session?.user?.hasPaid, router, justSucceeded, hasAccess]);

  // ------------------------------------------------------------
  // Load Course Data — list first, then detail by slug
  // ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // 1) Get published courses list
        const listRes = await fetch("/api/courses", { cache: "no-store" });
        const listJson = await listRes.json();
        const first = Array.isArray(listJson?.courses) ? listJson.courses[0] : null;

        if (!first?.slug) {
          // No published courses → use local fallback to keep UX alive
          if (!cancelled) setCourse(LOCAL_PLACEHOLDER);
          return;
        }

        // 2) Get course detail by slug
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
        console.warn("[Course] Could not load course from API:", err);
        if (!cancelled) setCourse(LOCAL_PLACEHOLDER);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------------------------------------
  // Persist progress to localStorage (fast + always succeeds)
  // ------------------------------------------------------------
  useEffect(() => {
    try {
      const payload = { currentModuleIndex, currentLessonIndex, answers };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Quota exceeded or private mode → ignore; UX still works
    }
  }, [currentModuleIndex, currentLessonIndex, answers]);

  // ------------------------------------------------------------
  // Derived values for rendering
  // ------------------------------------------------------------
  const modules: CourseModule[] = course?.modules ?? [];
  const currentModule = modules[currentModuleIndex] ?? modules[0];
  const currentLesson =
    currentModule?.lessons?.[currentLessonIndex] ??
    currentModule?.lessons?.[0];

  const totalLessons = modules.reduce(
    (sum, m) => sum + (m.lessons?.length ?? 0),
    0
  );
  const completed =
    modules
      .slice(0, currentModuleIndex)
      .reduce((sum, m) => sum + (m.lessons?.length ?? 0), 0) +
    currentLessonIndex +
    1;

  const progressPercent =
    totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;

  // ------------------------------------------------------------
  // Navigation Helpers (wrapped in useCallback for stable refs)
  // - These are referenced in global keydown handler → avoid stale closures
  // ------------------------------------------------------------
  const goNextLesson = useCallback(() => {
    const lessons = currentModule?.lessons ?? [];
    const lastIndex = lessons.length - 1;

    if (currentLessonIndex < lastIndex) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    } else if (currentModuleIndex < modules.length - 1) {
      setCurrentModuleIndex(currentModuleIndex + 1);
      setCurrentLessonIndex(0);
    }
  }, [currentModule?.lessons, currentLessonIndex, currentModuleIndex, modules.length]);

  const goPrevLesson = useCallback(() => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex(currentLessonIndex - 1);
    } else if (currentModuleIndex > 0) {
      const prevModuleIndex = currentModuleIndex - 1;
      setCurrentModuleIndex(prevModuleIndex);
      const prevLessons = modules[prevModuleIndex]?.lessons ?? [];
      setCurrentLessonIndex(prevLessons.length - 1);
    }
  }, [currentLessonIndex, currentModuleIndex, modules]);

  // ------------------------------------------------------------
  // Keyboard Navigation (← →)
  // - Registered once with stable callbacks
  // ------------------------------------------------------------
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNextLesson();
      if (e.key === "ArrowLeft") goPrevLesson();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNextLesson, goPrevLesson]);

  // ------------------------------------------------------------
  // Render States (loading, no access, no course)
  // ------------------------------------------------------------
  if (loading)
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">
          {justSucceeded
            ? "Finalizing your payment..."
            : "Checking course access..."}
        </p>
      </section>
    );

  if (!hasAccess) return null;

  if (!course)
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Preparing your course…</p>
      </section>
    );

  // ------------------------------------------------------------
  // Main JSX
  // ------------------------------------------------------------
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-10 sm:py-12 lg:py-16">
      <div className="mx-auto w-[92%] max-w-7xl">
        {/* Sticky Header with context + progress */}
        <div className="sticky top-0 z-20 bg-gradient-to-b from-blue-700 to-blue-500/90 backdrop-blur-sm mb-6 sm:mb-8 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 shadow-md">
          <div>
            <button
              onClick={() => router.push("/dashboard")}
              className="text-sm text-blue-100 hover:text-white underline underline-offset-2"
              aria-label="Back to dashboard"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-white font-extrabold text-3xl sm:text-4xl tracking-tight">
              {course.title}
            </h1>
            {course.summary && (
              <p className="text-blue-100 mt-1">{course.summary}</p>
            )}
          </div>

          <div
            className="inline-flex items-center gap-2 bg-white/90 text-blue-900 font-semibold px-3 py-1.5 rounded-lg shadow"
            aria-live="polite"
          >
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
            {progressPercent}% complete
          </div>
        </div>

        {/* Two-column layout: sidebar (modules) + main (content) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar (presentational) */}
          <div className="lg:col-span-4">
            <ModuleList
              modules={modules}
              currentModuleIndex={currentModuleIndex}
              currentLessonIndex={currentLessonIndex}
              onSelectModule={(idx) => {
                setCurrentModuleIndex(idx);
                setCurrentLessonIndex(0);
              }}
            />
          </div>

          {/* Main Content with Framer Motion enter/exit transition */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentModuleIndex}-${currentLessonIndex}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{
                  duration: 0.35,
                  ease: [0.25, 0.8, 0.25, 1],
                }}
                className="h-full w-full bg-white/95 rounded-2xl shadow-lg p-5 sm:p-6 space-y-5"
              >
                {/* Lesson Header with navigation */}
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
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={goPrevLesson}
                      disabled={currentModuleIndex === 0 && currentLessonIndex === 0}
                      className="px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 text-gray-800 font-semibold"
                    >
                      ◀ Previous
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={goNextLesson}
                      disabled={
                        currentModuleIndex === modules.length - 1 &&
                        currentLessonIndex ===
                          (currentModule?.lessons?.length ?? 1) - 1
                      }
                      className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold shadow"
                    >
                      Next ▶
                    </motion.button>
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
                    <p className="text-gray-800 leading-relaxed">
                      {currentLesson.body}
                    </p>
                  </div>
                )}

                {/* Quiz (engagement only; no scoring UI) */}
                {currentLesson?.quiz && (
                  <QuizCard
                    quiz={currentLesson.quiz}
                    answers={answers}
                    onChange={(id, idx) => setAnswers((p) => ({ ...p, [id]: idx }))}
                    onSubmit={() => {
                      // Phase design: quizzes are for engagement; advance on submit
                      console.log("Quiz answers:", answers);
                      goNextLesson();
                    }}
                  />
                )}

                {/* 🎓 Certificate appears once the user reaches 100% completion */}
                {progressPercent === 100 && (
                  <div className="pt-3 mt-2 border-t border-gray-200">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
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
                                 bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-transform"
                      aria-label="Download certificate of completion"
                    >
                      <span role="img" aria-label="graduation cap">🎓</span>
                      Download Certificate
                    </motion.button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

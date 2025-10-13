// app/dashboard/course/page.tsx
//
// ============================================================
// Course Page — Robust access gating + full UI restored
// ============================================================
//
// What this file ensures:
// - ✅ No “blank page”: we always render a user-friendly fallback instead of `return null`
// - ✅ Null-safe useSearchParams(): `(searchParams?.get(...) ?? "")` avoids CI type errors
// - ✅ Abort-safe fetch: ignores expected aborts/unmounts (No noisy console errors)
// - ✅ Polling after Stripe success: briefly re-check access so UI flips quickly
// - ✅ Keyboard navigation: ← → switches lessons
// - ✅ Progress persistence: stored in localStorage
// - ✅ Your full UI restored: sticky header, ModuleList, VideoPlayer, QuizCard, certificate button
//
// Pillars: efficiency, robustness, simplicity, ease of management, security
// - Efficiency: only minimal polling on `?success=true`, quick bailouts on abort
// - Robustness: defensive guards, never `return null` for primary states
// - Simplicity: single file concentrates page behavior; comments explain critical parts
// - Ease of management: predictable state flow; safe cleanup on unmount
// - Security: access is determined server-side (/api/payments/check); UI follows

"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

// ✅ Framer Motion for lightweight animation
import { motion, AnimatePresence } from "framer-motion";

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
// Local fallback course (shown if API fails)
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
// Suspense wrapper – isolates data/loading states
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

  // ⚠️ Build fix:
  // `useSearchParams()` can be typed as possibly `null` in some setups.
  // We make it null-safe using optional chaining and a default fallback string.
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  // ✅ Null-safe query param access
  const justSucceeded = (searchParams?.get("success") ?? "") === "true";

  // ---------- Access & Course State ----------
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [packageType, setPackageType] =
    useState<"individual" | "business" | null>(null);
  const [latestPayment, setLatestPayment] =
    useState<PaymentCheckResponse["latestPayment"]>(null);
  const didRedirect = useRef(false);

  const [course, setCourse] = useState<CourseDetail | null>(null);

  // ---------- Progress (persistent) ----------
  type Persisted = {
    currentModuleIndex: number;
    currentLessonIndex: number;
    answers: Record<string, number | null>;
  };
  const STORAGE_KEY = "course:progress:v1";

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
      // ignore JSON parse / access errors
    }
    return { currentModuleIndex: 0, currentLessonIndex: 0, answers: {} };
  }, []);

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
  // 🛡 Authoritative Access Check (abort-safe + post-payment polling)
  // ------------------------------------------------------------
  useEffect(() => {
    const ac = new AbortController();
    let unmounted = false;

    const checkOnce = async () => {
      try {
        const res = await fetch("/api/payments/check", {
          signal: ac.signal,
          cache: "no-store",
        });
        const data: PaymentCheckResponse = await res.json();
        return { ok: res.ok, data };
      } catch (err: any) {
        // 🧹 Swallow expected aborts (strict mode remounts, nav changes, etc.)
        if (
          err?.name === "AbortError" ||
          err === "component-unmounted" ||
          err?.message === "component-unmounted"
        ) {
          return {
            ok: false,
            data: { hasAccess: false, packageType: null, latestPayment: null },
          };
        }
        throw err; // real errors propagate
      }
    };

    const run = async () => {
      if (status === "loading") return;

      try {
        // Trust session for immediate UX
        if (session?.user?.hasPaid) setHasAccess(true);

        // First authoritative probe
        const first = await checkOnce();
        if (unmounted || ac.signal.aborted) return;

        if (first.ok && first.data.hasAccess) {
          setHasAccess(true);
          setPackageType(first.data.packageType);
          setLatestPayment(first.data.latestPayment);
        } else if (justSucceeded) {
          // After redirect from Stripe, poll briefly while webhook lands
          for (let i = 0; i < 8; i++) {
            if (unmounted || ac.signal.aborted) break;
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

        // If still no access → redirect to Upgrade (once)
        if (!hasAccess && !session?.user?.hasPaid && !didRedirect.current) {
          didRedirect.current = true;
          router.push("/dashboard/upgrade");
        }
      } catch (err: any) {
        // Only log real unexpected errors (ignore controlled aborts)
        if (
          err?.name !== "AbortError" &&
          err !== "component-unmounted" &&
          err?.message !== "component-unmounted"
        ) {
          console.error("[Course] Access check failed:", err);
        }
        if (!didRedirect.current && !unmounted) {
          didRedirect.current = true;
          router.push("/dashboard/upgrade");
        }
      } finally {
        if (!unmounted) setLoading(false);
      }
    };

    run();

    // ✅ Cleanup: abort fetch with *reason* to silence devtools error noise
    return () => {
      unmounted = true;
      if (!ac.signal.aborted) ac.abort("component-unmounted");
    };

    // Keep deps minimal; don't include `hasAccess` or we'll re-run unnecessarily
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.hasPaid, router, justSucceeded]);

  // ------------------------------------------------------------
  // Load Course Data (with fallback)
  // ------------------------------------------------------------
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
      } catch {
        if (!cancelled) setCourse(LOCAL_PLACEHOLDER);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------------------------------------
  // Keyboard Navigation (← →)
  // ------------------------------------------------------------
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNextLesson();
      if (e.key === "ArrowLeft") goPrevLesson();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // no deps → re-register only on mount/unmount
  }, [currentLessonIndex, currentModuleIndex]); // (optional) include to keep arrows responsive after state changes

  // ------------------------------------------------------------
  // Persist progress to localStorage
  // ------------------------------------------------------------
  useEffect(() => {
    try {
      const payload = { currentModuleIndex, currentLessonIndex, answers };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota / storage access errors
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
  // Navigation Helpers
  // ------------------------------------------------------------
  const goNextLesson = () => {
    const lessons = currentModule?.lessons ?? [];
    const lastIndex = lessons.length - 1;
    if (currentLessonIndex < lastIndex) {
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
      setCurrentLessonIndex(prevLessons.length - 1);
    }
  };

  // ------------------------------------------------------------
  // Render States (never render null → no blank page)
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

  if (!hasAccess) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">
          You don’t currently have access to this course.
        </p>
      </section>
    );
  }

  if (!course)
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Preparing your course…</p>
      </section>
    );

  // ------------------------------------------------------------
  // Main JSX (FULL UI RESTORED)
  // ------------------------------------------------------------
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-10 sm:py-12 lg:py-16">
      <div className="mx-auto w-[92%] max-w-7xl">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-gradient-to-b from-blue-700 to-blue-500/90 backdrop-blur-sm mb-6 sm:mb-8 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 shadow-md">
          <div>
            <button
              onClick={() => router.push("/dashboard")}
              className="text-sm text-blue-100 hover:text-white underline underline-offset-2"
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

          <div className="inline-flex items-center gap-2 bg-white/90 text-blue-900 font-semibold px-3 py-1.5 rounded-lg shadow">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
            {progressPercent}% complete
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar */}
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

          {/* Main Content Area with Motion */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentModuleIndex}-${currentLessonIndex}`} // ✅ correct template literal
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{
                  duration: 0.35,
                  ease: [0.25, 0.8, 0.25, 1],
                }}
                className="h-full w-full bg-white/95 rounded-2xl shadow-lg p-5 sm:p-6 space-y-5"
              >
                {/* Lesson Header */}
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-blue-900">
                      {currentModule?.title ?? "Module"}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {currentLesson?.title ?? "Lesson"}
                    </p>
                  </div>

                  {/* Navigation Buttons (animated on tap) */}
                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={goPrevLesson}
                      disabled={
                        currentModuleIndex === 0 && currentLessonIndex === 0
                      }
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

                {/* Lesson Content */}
                {currentLesson?.videoUrl ? (
                  <VideoPlayer
                    src={currentLesson.videoUrl}
                    title={`${currentModule?.title ?? ""} — ${
                      currentLesson?.title ?? ""
                    }`}
                  />
                ) : (
                  <div className="w-full aspect-video bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                    <p className="text-gray-500">No video for this lesson.</p>
                  </div>
                )}

                {currentLesson?.body && (
                  <div className="prose prose-blue max-w-none">
                    <p className="text-gray-800 leading-relaxed">
                      {currentLesson.body}
                    </p>
                  </div>
                )}

                {currentLesson?.quiz && (
                  <QuizCard
                    quiz={currentLesson.quiz}
                    answers={answers}
                    onChange={(id, idx) =>
                      setAnswers((p) => ({ ...p, [id]: idx }))
                    }
                    onSubmit={() => {
                      console.log("Quiz answers:", answers);
                      goNextLesson();
                    }}
                  />
                )}

                {/* Certificate Button (animated) */}
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
                          alert(
                            "Something went wrong generating your certificate."
                          );
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg font-semibold
                                 bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-transform"
                      aria-label="Download certificate of completion"
                    >
                      <span role="img" aria-label="graduation cap">
                        🎓
                      </span>
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

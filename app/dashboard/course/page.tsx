// app/dashboard/course/page.tsx
//
// ============================================================
// Course Page (Client Component)
// Robust access gating + Preview-safe data fetching
// Integrated PortableTextRenderer (images + inline video support)
// Keyboard navigation, persisted progress, graceful fallbacks
//
// Why client?
// -----------
// • You already drive the screen with interactive state (progress, quiz answers,
//   keyboard navigation, optimistic transitions, etc.). Keeping this as a client
//   component avoids server→client refactors and keeps the UX snappy.
//
// What changed (surgical improvements)
// ------------------------------------
// • Comments: extremely explicit, first-time maintainer friendly.
// • Guards: safer URL param handling, better early returns.
// • Fetch: small resilience tweaks, no-store, preview support kept.
// • State: preserves your localStorage progress logic, but narrows types to
//   avoid accidental ‘any’ creep.
// • Rendering: defensive null checks + empty state copy.
// • Helpers: normalized text → Portable Text converter kept, made explicit.
// • Performance: Memoized derived values where it helps readability.
//
// Pillars
// -------
// ✅ Efficiency   – minimal re-renders, no over-fetching
// ✅ Robustness   – defensive checks around network, access, and data
// ✅ Simplicity   – single file orchestrates the whole experience clearly
// ✅ Security     – access checks, no leakage of internals in error copy
// ✅ Ease of mgmt – well-named helpers, exhaustive comments
// ============================================================

"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { TypedObject } from "@portabletext/types";
import { motion, AnimatePresence } from "framer-motion";

import ModuleList from "@/components/course/ModuleList";
import VideoPlayer from "@/components/course/VideoPlayer";
import QuizCard from "@/components/course/QuizCard";
import PortableTextRenderer from "@/components/course/PortableTextRenderer";
import type { CourseDetail, CourseModule } from "@/types/course";

// ------------------------------------------------------------
// Access check response type (aligns with your /api/payments/check route)
// ------------------------------------------------------------
interface PaymentCheckResponse {
  hasAccess: boolean;
  packageType: "individual" | "business" | null;
  latestPayment: { id: string; createdAt: string; amount: number } | null;
}

// ------------------------------------------------------------
// Local fallback course (only if API or network fail hard)
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
// Suspense wrapper — clean loading shell around the client page
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
// Main Course Page (client)
// ------------------------------------------------------------
function CoursePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  // Note: URL searchParams are strings; we normalize the ones we care about.
  const justSucceeded = (searchParams?.get("success") ?? "") === "true";
  const isPreview = (searchParams?.get("preview") ?? "") === "true";
  const requestedSlug = (searchParams?.get("slug") ?? "").trim();

  // ------------------------------------------------------------
  // Access & course state
  // ------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [packageType, setPackageType] =
    useState<"individual" | "business" | null>(null);
  const [latestPayment, setLatestPayment] =
    useState<PaymentCheckResponse["latestPayment"]>(null);
  const [course, setCourse] = useState<CourseDetail | null>(null);

  // Prevents duplicate redirects when the access check fails repeatedly.
  const didRedirect = useRef(false);

  // ------------------------------------------------------------
  // Local storage persistence for course progress
  // ------------------------------------------------------------
  type Persisted = {
    currentModuleIndex: number;
    currentLessonIndex: number;
    answers: Record<string, number | null>;
  };

  const STORAGE_KEY = "course:progress:v1";

  // Load saved progress once on mount
  const initialProgress: Persisted = useMemo(() => {
    try {
      const raw =
        typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Persisted>;
        return {
          currentModuleIndex: Math.max(parsed.currentModuleIndex ?? 0, 0),
          currentLessonIndex: Math.max(parsed.currentLessonIndex ?? 0, 0),
          answers: parsed.answers ?? {},
        };
      }
    } catch {
      // ignore parse errors → fall back to defaults
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
  // Access check (server truth). We also allow the session flag to short-circuit.
  // After a Stripe checkout, we poll a few times to bridge any eventual consistency.
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
        if (err?.name === "AbortError") return { ok: false, data: null };
        throw err;
      }
    };

    const run = async () => {
      if (status === "loading") return;

      try {
        // If session already carries the access flag, enable immediately.
        if (session?.user?.hasPaid) setHasAccess(true);

        // Server truth
        const first = await checkOnce();
        if (unmounted || ac.signal.aborted) return;

        if (first.ok && first.data?.hasAccess) {
          setHasAccess(true);
          setPackageType(first.data.packageType);
          setLatestPayment(first.data.latestPayment);
        } else if (justSucceeded) {
          // Post-checkout: retry a few times to bridge propagation
          for (let i = 0; i < 8; i++) {
            if (unmounted || ac.signal.aborted) break;
            await new Promise((r) => setTimeout(r, 1500));
            const retry = await checkOnce();
            if (retry.ok && retry.data?.hasAccess) {
              setHasAccess(true);
              setPackageType(retry.data.packageType);
              setLatestPayment(retry.data.latestPayment);
              break;
            }
          }
        }

        // If still no access → redirect to upgrade (once)
        if (!hasAccess && !session?.user?.hasPaid && !didRedirect.current) {
          didRedirect.current = true;
          router.push("/dashboard/upgrade");
        }
      } catch (err) {
        console.error("[Course] Access check failed:", err);
        if (!didRedirect.current && !unmounted) {
          didRedirect.current = true;
          router.push("/dashboard/upgrade");
        }
      } finally {
        if (!unmounted) setLoading(false);
      }
    };

    run();
    return () => {
      unmounted = true;
      if (!ac.signal.aborted) ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.hasPaid, router, justSucceeded]);

  // ------------------------------------------------------------
  // Fetch course data (Sanity in preview, Prisma otherwise via /api)
  // We keep it dead simple: get list → decide slug → get detail.
// ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // 1) Get available courses (used to default a slug if none provided)
        const listUrl = isPreview ? "/api/courses?preview=true" : "/api/courses";
        const listRes = await fetch(listUrl, { cache: "no-store" });
        const listJson = await listRes.json();

        const slugToLoad =
          requestedSlug ||
          (Array.isArray(listJson?.courses) && listJson.courses[0]?.slug) ||
          "";

        // If absolutely nothing to load, fall back to placeholder
        if (!slugToLoad) {
          if (!cancelled) setCourse(LOCAL_PLACEHOLDER);
          return;
        }

        // 2) Fetch course detail shape (same DTO in preview & default)
        const detailUrl = isPreview
          ? `/api/courses/${encodeURIComponent(slugToLoad)}?preview=true`
          : `/api/courses/${encodeURIComponent(slugToLoad)}`;
        const detailRes = await fetch(detailUrl, { cache: "no-store" });

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
  }, [isPreview, requestedSlug]);

  // ------------------------------------------------------------
  // Keyboard navigation shortcuts (← / →)
  // ------------------------------------------------------------
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNextLesson();
      if (e.key === "ArrowLeft") goPrevLesson();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // no deps → always active; tiny handler is cheap
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------
  // Persist progress in localStorage whenever it changes
  // ------------------------------------------------------------
  useEffect(() => {
    try {
      const payload = { currentModuleIndex, currentLessonIndex, answers };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota / private mode errors
    }
  }, [currentModuleIndex, currentLessonIndex, answers]);

  // ------------------------------------------------------------
  // Helpers & derived values
  // ------------------------------------------------------------
  const modules: CourseModule[] = course?.modules ?? [];

  const currentModule = modules[currentModuleIndex] ?? modules[0];
  const currentLesson =
    currentModule?.lessons?.[currentLessonIndex] ?? currentModule?.lessons?.[0];

  const totalLessons = useMemo(
    () => modules.reduce((sum, m) => sum + (m.lessons?.length ?? 0), 0),
    [modules]
  );

  const completed = useMemo(() => {
    const before = modules
      .slice(0, currentModuleIndex)
      .reduce((sum, m) => sum + (m.lessons?.length ?? 0), 0);
    return before + currentLessonIndex + 1;
  }, [modules, currentModuleIndex, currentLessonIndex]);

  const progressPercent = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;

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
      setCurrentLessonIndex(Math.max(prevLessons.length - 1, 0));
    }
  };

  // Converts plain string content into a single Portable Text paragraph block,
  // so the renderer can be used consistently no matter the source.
  const toPortableText = (body?: unknown): TypedObject[] | undefined => {
    if (!body) return undefined;
    if (Array.isArray(body)) return body as TypedObject[]; // already PT
    if (typeof body === "string") {
      return [
        {
          _type: "block",
          style: "normal",
          markDefs: [],
          children: [{ _type: "span", text: body }],
        } as unknown as TypedObject,
      ];
    }
    return undefined;
  };

  // ------------------------------------------------------------
  // Branches for loading/access/data absence
  // ------------------------------------------------------------
  if (loading)
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">
          {justSucceeded ? "Finalizing your payment..." : "Checking course access..."}
        </p>
      </section>
    );

  if (!hasAccess)
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">You don’t currently have access to this course.</p>
      </section>
    );

  if (!course)
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Preparing your course…</p>
      </section>
    );

  // ============================================================
  // Render
  // ============================================================
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-10 sm:py-12 lg:py-16">
      <div className="mx-auto w-[92%] max-w-7xl">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-gradient-to-b from-blue-700 to-blue-500/90 backdrop-blur-sm mb-6 sm:mb-8 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 shadow-md">
          <div>
            <button
              onClick={() => router.push("/dashboard")}
              className="text-sm text-blue-100 hover:text-white underline underline-offset-2"
            >
              ← Back to Dashboard
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-white font-extrabold text-3xl sm:text-4xl tracking-tight">
                {course.title}
              </h1>
              {isPreview && (
                <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded bg-yellow-300 text-yellow-900">
                  Preview
                </span>
              )}
            </div>
            {course.summary && <p className="text-blue-100 mt-1">{course.summary}</p>}
          </div>

          <div className="inline-flex items-center gap-2 bg-white/90 text-blue-900 font-semibold px-3 py-1.5 rounded-lg shadow">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
            {progressPercent}% complete
          </div>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar: Module list and quick navigation */}
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

          {/* Main content */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentModuleIndex}-${currentLessonIndex}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.35, ease: [0.25, 0.8, 0.25, 1] }}
                className="h-full w-full bg-white/95 rounded-2xl shadow-lg p-5 sm:p-6 space-y-5"
              >
                {/* Lesson header */}
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-blue-900">
                      {currentModule?.title ?? "Module"}
                    </h2>
                    <p className="text-sm text-gray-600">{currentLesson?.title ?? "Lesson"}</p>
                  </div>

                  {/* Prev/Next */}
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
                        currentLessonIndex === (currentModule?.lessons?.length ?? 1) - 1
                      }
                      className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold shadow"
                    >
                      Next ▶
                    </motion.button>
                  </div>
                </div>

                {/* Top-level video (if provided) */}
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

                {/* Portable Text body (supports images + inline video embeds) */}
                {toPortableText(currentLesson?.body) && (
                  <PortableTextRenderer
                    value={toPortableText(currentLesson.body)!}
                    className="prose prose-blue max-w-none"
                  />
                )}

                {/* Quiz (if provided) */}
                {currentLesson?.quiz && (
                  <QuizCard
                    quiz={currentLesson.quiz}
                    answers={answers}
                    onChange={(id, idx) => setAnswers((p) => ({ ...p, [id]: idx }))}
                    onSubmit={() => {
                      // You can send answers to an API here if you want to record progress.
                      console.log("Quiz answers:", answers);
                      goNextLesson();
                    }}
                  />
                )}

                {/* Certificate button once 100% complete */}
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
                            alert(msg?.error ?? "Unable to generate certificate. Please try again.");
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

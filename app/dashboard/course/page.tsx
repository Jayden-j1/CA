// app/dashboard/course/page.tsx
//
// Purpose:
// - Stubbed course flow UI (modules, video placeholder, and quiz stepper).
// - Fully React-compliant: hook order consistent across renders.
// - Access gating retained from your original logic.
// - Well-commented for clarity, simplicity, and future extensibility.

"use client";

import { Suspense } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

import FullPageSpinner from "@/components/ui/fullPageSpinner";

// ---------------------------
// Type Definitions
// ---------------------------

// Access check response structure from API
interface PaymentCheckResponse {
  hasAccess: boolean;
  packageType: "individual" | "business" | null;
  latestPayment: {
    id: string;
    createdAt: string;
    amount: number;
  } | null;
}

// Course content structure (stub)
interface Module {
  id: string;
  title: string;
  videoUrl: string; // Placeholder only for now
  quiz?: Quiz;
}

interface Quiz {
  questions: {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
  }[];
}

// ---------------------------
// Suspense Wrapper
// ---------------------------
// - Provides a loading boundary for useSearchParams and other client hooks.
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

// ---------------------------
// Main Course Page Component
// ---------------------------
// NOTE: All hooks are now placed at the top level (before any conditional return).
// This ensures consistent hook order between renders — fixing the React hook error.
function CoursePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  // Extract query params safely
  const justSucceeded = searchParams.get("success") === "true";

  // ---------------------------
  // State Hooks (placed before any conditional return)
  // ---------------------------

  // Access gating
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [packageType, setPackageType] = useState<"individual" | "business" | null>(null);
  const [latestPayment, setLatestPayment] =
    useState<PaymentCheckResponse["latestPayment"]>(null);

  // Local reference to prevent multiple redirects
  const didRedirect = useRef(false);

  // Stubbed course progression
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);

  // Quiz answer tracking
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number | null>>({});

  // ---------------------------
  // Access Check Logic
  // ---------------------------
  // - Runs only once per mount or when user/session changes.
  // - Verifies if user has purchased access (PACKAGE or STAFF_SEAT).
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
        // Optimistic unlock if session claims paid
        if (session?.user?.hasPaid) {
          setHasAccess(true);
        }

        // First server check
        const first = await checkOnce();
        if (first.ok && first.data.hasAccess) {
          setHasAccess(true);
          setPackageType(first.data.packageType);
          setLatestPayment(first.data.latestPayment);
          return;
        }

        // Retry loop if user just completed payment
        if (justSucceeded) {
          const maxAttempts = 8; // ~12s total
          const delayMs = 1500;
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise((r) => setTimeout(r, delayMs));
            const retry = await checkOnce();
            if (retry.ok && retry.data.hasAccess) {
              setHasAccess(true);
              setPackageType(retry.data.packageType);
              setLatestPayment(retry.data.latestPayment);
              return;
            }
          }
        }

        // If not allowed, redirect to upgrade page
        if (!didRedirect.current) {
          didRedirect.current = true;
          router.push("/dashboard/upgrade");
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[CourseContent] Access check failed:", err);
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
  }, [status, session?.user?.hasPaid, router, justSucceeded]);

  // ---------------------------
  // Stubbed Modules (static placeholder)
  // ---------------------------
  const modules: Module[] = [
    {
      id: "m1",
      title: "Introduction to Country & Connection",
      videoUrl: "https://example.com/video1.mp4",
      quiz: {
        questions: [
          {
            id: "q1",
            question: "What does Country mean to Indigenous people?",
            options: ["A place", "Identity & law", "Just land", "None"],
            correctIndex: 1,
          },
        ],
      },
    },
    {
      id: "m2",
      title: "Impacts of Colonisation",
      videoUrl: "https://example.com/video2.mp4",
      quiz: {
        questions: [
          {
            id: "q2",
            question: "Colonisation led to dispossession of ...?",
            options: ["Cities", "Land", "Rivers", "Language"],
            correctIndex: 1,
          },
        ],
      },
    },
    {
      id: "m3",
      title: "Reconciliation & Protocols",
      videoUrl: "https://example.com/video3.mp4",
      quiz: {
        questions: [
          {
            id: "q3",
            question: "Protocol is about ...?",
            options: ["Rules", "Respect", "Silence", "Ceremony"],
            correctIndex: 1,
          },
        ],
      },
    },
  ];

  const currentModule = modules[currentModuleIndex];

  // Initialize quiz answers only once (on mount)
  useEffect(() => {
    const init: Record<string, number | null> = {};
    modules.forEach((mod) => {
      if (mod.quiz) {
        mod.quiz.questions.forEach((q) => {
          init[q.id] = null;
        });
      }
    });
    setQuizAnswers(init);
  }, []);

  // ---------------------------
  // Quiz submission handler
  // ---------------------------
  const handleQuizSubmit = () => {
    console.log("Quiz answers:", quizAnswers);

    if (currentModuleIndex < modules.length - 1) {
      setCurrentModuleIndex(currentModuleIndex + 1);
    } else {
      console.log("✅ Course finished!");
    }
  };

  // ---------------------------
  // Conditional rendering (AFTER all hooks)
  // ---------------------------
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

  // ---------------------------
  // Main Course Layout
  // ---------------------------
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center gap-12">
      {/* Title */}
      <h1 className="text-white font-bold text-4xl sm:text-5xl text-center">
        Course Content
      </h1>

      {/* Package info */}
      {packageType && (
        <p className="text-white mb-2 text-lg">
          You are on the <strong>{packageType}</strong> package.
        </p>
      )}
      {latestPayment && (
        <p className="text-white mb-6 text-md">
          Last purchase: <strong>${latestPayment.amount}</strong> on{" "}
          {new Date(latestPayment.createdAt).toLocaleDateString()}
        </p>
      )}

      {/* Content Container */}
      <div className="w-[90%] sm:w-[600px] md:w-[800px] bg-white rounded-xl p-6 shadow-xl">
        {/* Module Navigation */}
        <div className="mb-6">
          {modules.map((mod, idx) => (
            <button
              key={mod.id}
              onClick={() => setCurrentModuleIndex(idx)}
              className={`px-4 py-2 mr-2 rounded-lg ${
                idx === currentModuleIndex
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {idx + 1}. {mod.title}
            </button>
          ))}
        </div>

        {/* Module Display */}
        <div className="space-y-6">
          {/* Video Placeholder */}
          <div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">
              Video Player for "{currentModule.title}"
            </p>
          </div>

          {/* Quiz Section */}
          {currentModule.quiz && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">
                Quiz: Test your knowledge
              </h3>

              {currentModule.quiz.questions.map((q) => (
                <div key={q.id} className="mb-4">
                  <p className="font-medium mb-2">{q.question}</p>
                  <div className="space-x-2">
                    {q.options.map((opt, i) => (
                      <label
                        key={i}
                        className="inline-flex items-center space-x-2"
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={i}
                          checked={quizAnswers[q.id] === i}
                          onChange={() =>
                            setQuizAnswers((prev) => ({ ...prev, [q.id]: i }))
                          }
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <button
                onClick={handleQuizSubmit}
                className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition transform hover:scale-[1.02]"
              >
                Submit & Continue
              </button>
            </div>
          )}

          {!currentModule.quiz && (
            <p className="text-gray-500">No quiz for this module.</p>
          )}
        </div>
      </div>
    </section>
  );
}

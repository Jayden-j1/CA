// app/dashboard/page.tsx
//
// Purpose:
// - Root dashboard landing page with visually polished main content (Div 1)
//   plus three complementary panels:
//     • Div 2: Quick Actions (role-aware, access-aware)
//     • Div 3: Progress Tracker (circular; placeholder value)
//     • Div 4: Cultural Highlight (rotating quotes/facts)
//
// Key improvements:
// - Fixed React hook order error by moving all hooks above conditional returns.
// - Maintains clean structure and best practices.
//

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import FullPageSpinner from "@/components/ui/fullPageSpinner";
import TextType from "@/components/dashboard/TypingText";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";

export default function DashboardPage() {
  // ---------------- Session & Navigation ----------------
  const { data: session, status } = useSession();
  const router = useRouter();

  // ---------------- Derived Role Info ----------------
  const role = session?.user?.role ?? "USER";
  const businessId = session?.user?.businessId ?? null;
  const sessionHasPaid = Boolean(session?.user?.hasPaid);
  const isOwnerOrAdmin = role === "BUSINESS_OWNER" || role === "ADMIN";
  const isStaffSeatUser = role === "USER" && businessId !== null;
  const isIndividualUser = role === "USER" && businessId === null;

  // ---------------- Server Access Probe ----------------
  // Always declare hooks before any conditional return.
  const [serverHasAccess, setServerHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const res = await fetch("/api/payments/check", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setServerHasAccess(Boolean(res.ok && data?.hasAccess));
      } catch {
        if (!cancelled) setServerHasAccess(false);
      }
    };
    probe();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------- Progress (placeholder animation) ----------------
  const [progress, setProgress] = useState<number>(0);
  useEffect(() => {
    let mounted = true;
    const target = 45;
    let val = 0;
    const step = () => {
      if (!mounted) return;
      val = Math.min(val + 5, target);
      setProgress(val);
      if (val < target) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return () => {
      mounted = false;
    };
  }, []);

  // ---------------- Rotating Cultural Highlights ----------------
  const highlights = useMemo(
    () => [
      {
        quote: "When you know the Country, you know yourself. Everything is connected.",
        author: "— Aunty Lorraine, Elder",
      },
      {
        quote: "Country is identity, law, and responsibility — not just a place.",
        author: "— Community Teaching",
      },
      {
        quote: "Listening deeply means listening with the heart, not just the ears.",
        author: "— Cultural Protocols",
      },
      {
        quote: "Reconciliation grows through respect, truth-telling, and action.",
        author: "— Community Reminder",
      },
    ],
    []
  );

  const [highlightIndex, setHighlightIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setHighlightIndex((i) => (i + 1) % highlights.length);
    }, 10000);
    return () => clearInterval(id);
  }, [highlights.length]);
  const currentHighlight = highlights[highlightIndex];

  // ---------------- Access Logic ----------------
  const effectiveHasAccess = isOwnerOrAdmin || sessionHasPaid || serverHasAccess === true;

  // ---------------- Early Redirects ----------------
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return <FullPageSpinner message="Loading your dashboard..." />;
  }
  if (!session?.user) {
    return null;
  }

  // ---------------- Links ----------------
  const LINKS = {
    continueLearning: "/dashboard/course",
    exploreMap: "/dashboard/map",
    resources: "/dashboard/resources",
    manageStaff: "/dashboard/staff",
    billing: "/dashboard/billing",
    adminPanel: "/dashboard/admin",
    getAccess: "/pricing",
  };

  // ---------------- Greeting ----------------
  const greeting = (
    <TextType
      text={["JINGI WALLA!"]}
      typingSpeed={75}
      pauseDuration={1500}
      showCursor={true}
      cursorCharacter="|"
    />
  );

  // ---------------- Layout ----------------
  return (
    <div
      className="
        grid grid-cols-1 md:grid-cols-5 grid-rows-5
        gap-6 sm:gap-8
        p-4 sm:p-6 lg:p-10
        min-h-screen
        bg-gradient-to-br from-slate-900 via-blue-950 to-blue-900
      "
    >
      {/* Div 1 — Main Content */}
      <div className="col-span-1 md:col-span-3 row-span-2 flex items-center justify-center">
        <section
          className="
            w-full h-full
            flex flex-col items-center justify-center text-center
            rounded-2xl shadow-2xl
            bg-gradient-to-b from-blue-700 to-blue-300
            p-8 sm:p-10 lg:p-12
            text-white
            transition-all duration-500 ease-in-out
            hover:scale-[1.02] hover:shadow-blue-900/30
          "
        >
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight drop-shadow-md">
            {greeting}
          </h1>

          <p className="mt-6 text-lg sm:text-xl font-medium text-blue-100 tracking-wide">
            Logged in as{" "}
            <span className="font-bold text-white">{session.user.email}</span>
          </p>
          <p className="text-blue-100">Role: {role}</p>

          <p className="mt-8 text-base sm:text-lg leading-relaxed max-w-2xl text-blue-50/90">
            This is your personalised dashboard.
            <br className="hidden sm:block" />
            Use the navigation bar above to explore your tools and manage your
            learning journey.
          </p>
        </section>
      </div>

      {/* Div 2 — Quick Actions */}
      <div className="col-span-1 md:col-span-2 row-span-2 col-start-auto md:col-start-4">
        <section
          className="
            h-full w-full
            flex flex-col items-center justify-center
            bg-white/85 backdrop-blur-sm
            rounded-2xl shadow-lg hover:shadow-xl
            p-6 sm:p-8
            transition
          "
        >
          <h2 className="text-2xl font-bold text-blue-900 mb-4">Quick Actions</h2>
          <p className="text-sm text-gray-600 mb-6 text-center max-w-md">
            Continue your learning or explore key areas at your own pace.
          </p>

          <div className="w-full flex flex-col sm:flex-row gap-4 justify-center">
            {effectiveHasAccess ? (
              <>
                <a
                  href={LINKS.continueLearning}
                  className="flex-1 text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl shadow transition-transform hover:scale-[1.02]"
                >
                  ▶ Continue Learning
                </a>
                <a
                  href={LINKS.exploreMap}
                  className="flex-1 text-center bg-yellow-500 hover:bg-yellow-400 text-white font-semibold px-6 py-3 rounded-xl shadow transition-transform hover:scale-[1.02]"
                >
                  🗺 Explore Map
                </a>
              </>
            ) : (
              <a
                href={LINKS.getAccess}
                className="flex-1 text-center bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-xl shadow transition-transform hover:scale-[1.02]"
              >
                ☀️ Get Access
              </a>
            )}
          </div>

          <div className="w-full mt-4">
            <a
              href={LINKS.resources}
              className="block text-center bg-slate-800/90 hover:bg-slate-800 text-white font-semibold px-6 py-3 rounded-xl shadow transition-transform hover:scale-[1.02]"
            >
              👣 Cultural Protocols & Resources
            </a>
          </div>

          {isOwnerOrAdmin && (
            <div className="w-full mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href={LINKS.manageStaff}
                className="text-center bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg shadow transition-transform hover:scale-[1.02]"
              >
                🧒🏿👩🏾 Manage Staff
              </a>
              <a
                href={LINKS.billing}
                className="text-center bg-rose-600 hover:bg-rose-500 text-white font-semibold px-4 py-2 rounded-lg shadow transition-transform hover:scale-[1.02]"
              >
                💳 Billing
              </a>
              {role === "ADMIN" && (
                <a
                  href={LINKS.adminPanel}
                  className="text-center bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg shadow transition-transform hover:scale-[1.02] sm:col-span-2"
                >
                  🔧 Admin Panel
                </a>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Div 3 — Progress Tracker */}
      <div className="col-span-1 md:col-span-3 row-span-3 row-start-auto md:row-start-3">
        <section className="h-full w-full flex flex-col items-center justify-center text-center bg-white/85 backdrop-blur-sm rounded-2xl shadow-lg p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">Your Progress</h2>

          <div className="w-40 h-40 sm:w-48 sm:h-48">
            <CircularProgressbar
              value={progress}
              text={`${progress}%`}
              styles={buildStyles({
                textColor: "#1e3a8a",
                pathColor: "#2563eb",
                trailColor: "#dbeafe",
                textSize: "16px",
                pathTransition: "stroke-dashoffset 0.6s ease 0s",
              })}
            />
          </div>

          <p className="mt-4 text-sm text-gray-700 max-w-sm">
            You’re making steady progress. Keep going — learning is a journey.
          </p>

          <a
            href={LINKS.continueLearning}
            className="mt-5 inline-block text-white bg-blue-600 hover:bg-blue-500 px-5 py-2 rounded-lg font-semibold shadow transition-transform hover:scale-[1.02]"
          >
            Continue where you left off
          </a>
        </section>
      </div>

      {/* Div 4 — Cultural Highlight */}
      <div className="col-span-1 md:col-span-2 row-span-3 col-start-auto md:col-start-4 row-start-auto md:row-start-3">
        <section className="h-full w-full flex flex-col items-center justify-center text-center rounded-2xl shadow-lg p-6 sm:p-8 bg-gradient-to-br from-yellow-100 to-orange-100">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Cultural Highlight</h2>
          <p
            className="italic text-gray-700 leading-relaxed max-w-sm transition-opacity duration-500 ease-in-out"
            key={highlightIndex}
          >
            “{currentHighlight.quote}”
          </p>
          <p className="text-sm text-gray-600 mt-3">{currentHighlight.author}</p>
          <a
            href={LINKS.resources}
            className="mt-5 inline-block text-gray-900 bg-yellow-300 hover:bg-yellow-200 px-5 py-2 rounded-lg font-semibold shadow transition-transform hover:scale-[1.02]"
          >
            Learn more
          </a>
        </section>
      </div>
    </div>
  );
}

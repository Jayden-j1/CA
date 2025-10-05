// app/dashboard/page.tsx
//
// Purpose:
// - Root dashboard landing page with visually polished main content (Div 1)
//   plus three complementary panels:
//     • Div 2: Quick Actions (role-aware, access-aware)
//     • Div 3: Progress Tracker (circular; placeholder value, easy to wire later)
//     • Div 4: Cultural Highlight (rotating quotes/facts)
// - Keeps your existing auth/redirect logic intact.
// - Avoids layout overlap by using padding and grid gaps instead of external margins.
// - Adds a *lightweight* server check to confirm access so the UI reflects payments quickly.
//
// Notes:
// - Progress circle uses `react-circular-progressbar` (very lightweight).
//   Add the base styles to your global CSS once (App Router safe):
//     @import 'react-circular-progressbar/dist/styles.css';
// - Quick Actions are role-aware and access-aware:
//     • BUSINESS_OWNER / ADMIN → staff & billing links + learning
//     • USER (individual) → learning if paid, otherwise a "Get Access" CTA
//     • USER (staff seat) → access is granted once staff-seat payment is recorded; we probe server
//
// Pillars implemented:
// - Efficiency: minimal API calls (one tiny /api/payments/check probe on mount), memoization where helpful.
// - Robustness: UI falls back to session flags, but trusts server truth to avoid stale state.
// - Simplicity: role + access gates in one place; comments explain each decision.
// - Ease of management: hrefs collected in one section; change routes without rewriting logic.
// - Security: this is UI logic only; your API/middleware still enforce real access.

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import FullPageSpinner from "@/components/ui/fullPageSpinner";
import TextType from "@/components/dashboard/TypingText";

// ✅ Progress circle (CSS goes in globals; see header comment)
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // --- Redirect unauthenticated users (unchanged) ---
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // --- Show full-page spinner while checking session (unchanged) ---
  if (status === "loading") {
    return <FullPageSpinner message="Loading your dashboard..." />;
  }

  // --- Safety: if session is missing, show nothing (unchanged) ---
  if (!session?.user) {
    return null;
  }

  // --------------------------------------------------------------------------------
  // Role & access context (used by Quick Actions and copy)
  // --------------------------------------------------------------------------------
  const role = session.user.role; // "USER" | "BUSINESS_OWNER" | "ADMIN"
  const businessId = session.user.businessId ?? null; // non-null → staff/owner/admin in a business
  const sessionHasPaid = Boolean(session.user.hasPaid); // computed in NextAuth callbacks

  const isOwnerOrAdmin = role === "BUSINESS_OWNER" || role === "ADMIN";
  const isStaffSeatUser = role === "USER" && businessId !== null;
  const isIndividualUser = role === "USER" && businessId === null;

  // A tiny server truth probe so the UI updates quickly after Stripe webhooks:
  // - Returns {hasAccess} true if PACKAGE or STAFF_SEAT exists and user isActive.
  // - This complements session.user.hasPaid (which updates on next session refresh).
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

  // Effective access for showing actions:
  // - Owners/Admins always see learning (you may choose to gate owners too, but most businesses include owner access).
  // - Otherwise trust either the session OR server probe.
  const effectiveHasAccess =
    isOwnerOrAdmin || sessionHasPaid || serverHasAccess === true;

  // --------------------------------------------------------------------------------
  // Animated greeting (unchanged)
  // --------------------------------------------------------------------------------
  const greeting = (
    <TextType
      text={["JINGI WALLA!"]}
      typingSpeed={75}
      pauseDuration={1500}
      showCursor={true}
      cursorCharacter="|"
    />
  );

  // --------------------------------------------------------------------------------
  // Div 3 – Progress value (placeholder state)
  // --------------------------------------------------------------------------------
  // Replace with real data later (e.g., completed modules / total).
  // This animates smoothly on mount as a pleasant placeholder.
  const [progress, setProgress] = useState<number>(0);
  useEffect(() => {
    let mounted = true;
    const target = 45; // ← placeholder until wired to your course API
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

  // --------------------------------------------------------------------------------
  // Div 4 – Cultural Highlight (rotating quotes/facts)
  // --------------------------------------------------------------------------------
  const highlights = useMemo(
    () => [
      {
        quote:
          "When you know the Country, you know yourself. Everything is connected.",
        author: "— Aunty Lorraine, Elder",
      },
      {
        quote:
          "Country is identity, law, and responsibility — not just a place.",
        author: "— Community Teaching",
      },
      {
        quote:
          "Listening deeply means listening with the heart, not just the ears.",
        author: "— Cultural Protocols",
      },
      {
        quote:
          "Reconciliation grows through respect, truth-telling, and action.",
        author: "— Community Reminder",
      },
    ],
    []
  );

  const [highlightIndex, setHighlightIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setHighlightIndex((i) => (i + 1) % highlights.length);
    }, 10000); // rotate every 10s
    return () => clearInterval(id);
  }, [highlights.length]);

  const currentHighlight = highlights[highlightIndex];

  // --------------------------------------------------------------------------------
  // Hrefs: centralize here so you can tweak routes later without changing logic.
  // --------------------------------------------------------------------------------
  const LINKS = {
    continueLearning: "/dashboard/course",
    exploreMap: "/dashboard/map",
    resources: "/dashboard/resources",
    manageStaff: "/dashboard/staff",
    billing: "/dashboard/billing",
    adminPanel: "/dashboard/admin",
    // If your upgrade route differs, adjust here (e.g., "/pricing" or "/dashboard/upgrade")
    getAccess: "/pricing",
  };

  // ---------- Page Layout ----------
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
      {/* =============================================================================
          Div 1 — Main Content (existing; polished)
          ============================================================================= */}
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
          {/* Greeting headline */}
          <h1
            className="
              text-3xl sm:text-4xl lg:text-5xl
              font-extrabold tracking-tight leading-tight
              drop-shadow-md
            "
          >
            {greeting}
          </h1>

          {/* User info */}
          <p className="mt-6 text-lg sm:text-xl font-medium text-blue-100 tracking-wide">
            Logged in as{" "}
            <span className="font-bold text-white">{session.user.email}</span>
          </p>
          <p className="text-blue-100">Role: {role}</p>

          {/* Dashboard intro */}
          <p className="mt-8 text-base sm:text-lg leading-relaxed max-w-2xl text-blue-50/90">
            This is your personalised dashboard.
            <br className="hidden sm:block" />
            Use the navigation bar above to explore your tools and manage your
            learning journey.
          </p>
        </section>
      </div>

      {/* =============================================================================
          Div 2 — Quick Actions (role-aware + access-aware)
          - Owners/Admins: management & billing shortcuts + learning
          - Staff/Individuals: learning & map; show Get Access if needed
          ============================================================================= */}
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
          <h2 className="text-2xl font-bold text-blue-900 mb-4">
            Quick Actions
          </h2>

          <p className="text-sm text-gray-600 mb-6 text-center max-w-md">
            Continue your learning or explore key areas at your own pace.
          </p>

          {/* Primary quick actions:
             - If user has access (paid or business), show learning/map.
             - If not, show "Get Access" CTA instead of learning. */}
          <div className="w-full flex flex-col sm:flex-row gap-4 justify-center">
            {effectiveHasAccess ? (
              <>
                <a
                  href={LINKS.continueLearning}
                  className="
                    flex-1 text-center
                    bg-blue-600 hover:bg-blue-500 text-white
                    font-semibold px-6 py-3 rounded-xl shadow
                    transition-transform hover:scale-[1.02]
                  "
                >
                  ▶ Continue Learning
                </a>
                <a
                  href={LINKS.exploreMap}
                  className="
                    flex-1 text-center
                    bg-yellow-500 hover:bg-yellow-400 text-white
                    font-semibold px-6 py-3 rounded-xl shadow
                    transition-transform hover:scale-[1.02]
                  "
                >
                  🗺 Explore Map
                </a>
              </>
            ) : (
              <a
                href={LINKS.getAccess}
                className="
                  flex-1 text-center
                  bg-emerald-600 hover:bg-emerald-500 text-white
                  font-semibold px-6 py-3 rounded-xl shadow
                  transition-transform hover:scale-[1.02]
                "
              >
                ⭐ Get Access
              </a>
            )}
          </div>

          {/* Secondary action - shared */}
          <div className="w-full mt-4">
            <a
              href={LINKS.resources}
              className="
                block text-center
                bg-slate-800/90 hover:bg-slate-800
                text-white font-semibold px-6 py-3 rounded-xl shadow
                transition-transform hover:scale-[1.02]
              "
            >
              📘 Cultural Protocols & Resources
            </a>
          </div>

          {/* Owner/Admin management shortcuts (only if role permits) */}
          {isOwnerOrAdmin && (
            <div className="w-full mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href={LINKS.manageStaff}
                className="
                  text-center
                  bg-indigo-600 hover:bg-indigo-500 text-white
                  font-semibold px-4 py-2 rounded-lg shadow
                  transition-transform hover:scale-[1.02]
                "
              >
                👥 Manage Staff
              </a>
              <a
                href={LINKS.billing}
                className="
                  text-center
                  bg-rose-600 hover:bg-rose-500 text-white
                  font-semibold px-4 py-2 rounded-lg shadow
                  transition-transform hover:scale-[1.02]
                "
              >
                💳 Billing
              </a>

              {/* Optional: Admin-only panel (if you want it visible here) */}
              {role === "ADMIN" && (
                <a
                  href={LINKS.adminPanel}
                  className="
                    text-center
                    bg-slate-700 hover:bg-slate-600 text-white
                    font-semibold px-4 py-2 rounded-lg shadow
                    transition-transform hover:scale-[1.02]
                    sm:col-span-2
                  "
                >
                  🔧 Admin Panel
                </a>
              )}
            </div>
          )}
        </section>
      </div>

      {/* =============================================================================
          Div 3 — Progress Tracker (Circular)
          - Clean, accessible colors that match your palette.
          - The value is a placeholder; wire to real data later.
          ============================================================================= */}
      <div className="col-span-1 md:col-span-3 row-span-3 row-start-auto md:row-start-3">
        <section
          className="
            h-full w-full
            flex flex-col items-center justify-center text-center
            bg-white/85 backdrop-blur-sm
            rounded-2xl shadow-lg
            p-6 sm:p-8
          "
        >
          <h2 className="text-2xl font-bold text-blue-900 mb-4">
            Your Progress
          </h2>

          <div className="w-40 h-40 sm:w-48 sm:h-48">
            <CircularProgressbar
              value={progress}
              text={`${progress}%`}
              styles={buildStyles({
                // Text and path colors tuned to your gradient theme
                textColor: "#1e3a8a", // tailwind blue-900
                pathColor: "#2563eb", // tailwind blue-600
                trailColor: "#dbeafe", // tailwind blue-100
                textSize: "16px",
                // Smooth progress transitions
                pathTransition: "stroke-dashoffset 0.6s ease 0s",
              })}
            />
          </div>

          <p className="mt-4 text-sm text-gray-700 max-w-sm">
            You’re making steady progress. Keep going — learning is a journey.
          </p>

          {/* Optional: Quick nudge button */}
          <a
            href={LINKS.continueLearning}
            className="
              mt-5 inline-block
              text-white bg-blue-600 hover:bg-blue-500
              px-5 py-2 rounded-lg font-semibold
              shadow transition-transform hover:scale-[1.02]
            "
          >
            Continue where you left off
          </a>
        </section>
      </div>

      {/* =============================================================================
          Div 4 — Cultural Highlight (Rotating)
          - Short, respectful quotes/facts with subtle background gradient.
          ============================================================================= */}
      <div className="col-span-1 md:col-span-2 row-span-3 col-start-auto md:col-start-4 row-start-auto md:row-start-3">
        <section
          className="
            h-full w-full
            flex flex-col items-center justify-center text-center
            rounded-2xl shadow-lg
            p-6 sm:p-8
            bg-gradient-to-br from-yellow-100 to-orange-100
          "
        >
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Cultural Highlight
          </h2>

          {/* Quote body */}
          <p
            className="
              italic text-gray-700 leading-relaxed
              max-w-sm
              transition-opacity duration-500 ease-in-out
            "
            key={highlightIndex} // simple re-render to refresh fade
          >
            “{currentHighlight.quote}”
          </p>
          <p className="text-sm text-gray-600 mt-3">{currentHighlight.author}</p>

          {/* Optional: Learn more CTA */}
          <a
            href={LINKS.resources}
            className="
              mt-5 inline-block
              text-gray-900 bg-yellow-300 hover:bg-yellow-200
              px-5 py-2 rounded-lg font-semibold
              shadow transition-transform hover:scale-[1.02]
            "
          >
            Learn more
          </a>
        </section>
      </div>
    </div>
  );
}

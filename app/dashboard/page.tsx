// app/dashboard/page.tsx
//
// Purpose:
// - Root dashboard landing page with visually polished main content (Div 1)
//   plus three complementary panels:
//     • Div 2: Quick Actions (role-aware, access-aware)
//     • Div 3: Cultural Highlight (rotating quotes/facts)
//     • Div 4: Learning (neutral panel; NO progress bar or progress logic)
//
// Important to this fix:
// - Progress bar feature and all of its logic have been removed:
//   • No CircularProgressbar import/usages
//   • No animateTo helper
//   • No progress/progressTarget state or effects
//   • No /api/courses/* progress fetches
// - All other flows/logic kept intact (auth, access checks, role, layout).
//
// Pillars:
// - Simplicity & Robustness: clear separation of concerns.
// - Security & Performance: same access checks as before; no new flows touched.

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link"; // ✅ Next.js client-side navigation for internal links

import FullPageSpinner from "@/components/ui/fullPageSpinner";
import TextType from "@/components/dashboard/TypingText";

// PROGRESS BAR REMOVAL NOTES
// ----------------------------
// Removed:
//   import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
//   const COURSE_SLUG = "cultural-awareness-training";
//   animateTo(...) helper
//   progress/progressTarget state, refs, effects
//   fetches for course id and /api/.../progress
//   Progress Tracker panel content
//
// Kept:
//   Session/access logic, quick actions, cultural highlights, layout grid.

export default function DashboardPage() {
  // ---------------- Session & Navigation ----------------
  // Grab the authenticated session and auth status.
  const { data: session, status } = useSession();
  // Next.js app-router navigation hook.
  const router = useRouter();

  // ---------------- Derived Role Info ----------------
  // Safely derive role and related flags from the session.
  const role = session?.user?.role ?? "USER";
  const businessId = session?.user?.businessId ?? null;
  const sessionHasPaid = Boolean(session?.user?.hasPaid);

  // Role helpers for clarity in the UI logic.
  const isOwnerOrAdmin = role === "BUSINESS_OWNER" || role === "ADMIN";
  const isStaffSeatUser = role === "USER" && businessId !== null; // kept for parity (not used elsewhere here)
  const isIndividualUser = role === "USER" && businessId === null; // kept for parity

  // ---------------- Server Access Probe ----------------
  // This checks with the backend whether the user has access (e.g. payment state),
  // independent of what the session says (extra robustness).
  const [serverHasAccess, setServerHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const probe = async () => {
      try {
        // We explicitly avoid caching so the access state is always fresh.
        const res = await fetch("/api/payments/check", { cache: "no-store" });
        const data = await res.json();

        if (!cancelled) {
          // We only treat it as "has access" if the response is OK and the payload says so.
          setServerHasAccess(Boolean(res.ok && data?.hasAccess));
        }
      } catch {
        // On any error, we conservatively mark access as false (but do not crash).
        if (!cancelled) setServerHasAccess(false);
      }
    };

    probe();

    // Cleanup flag to avoid updating state on an unmounted component.
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------- Rotating Cultural Highlights ----------------
  // These are the rotating cultural quotes/facts shown in what is now Div 3.
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
    // Rotate the highlight every 10 seconds in a simple, robust way.
    const id = setInterval(() => {
      setHighlightIndex((i: number) => (i + 1) % highlights.length);
    }, 10000);

    // Clear interval on unmount to avoid memory leaks.
    return () => clearInterval(id);
  }, [highlights.length]);

  const currentHighlight = highlights[highlightIndex];

  // ---------------- Access Logic ----------------
  // Effective access is determined by either role or payment/access flags.
  const effectiveHasAccess =
    isOwnerOrAdmin || sessionHasPaid || serverHasAccess === true;

  // ---------------- Early Redirects ----------------
  // If the user is unauthenticated, send them to login.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // While we don't yet know the auth status, show a full-page spinner.
  if (status === "loading") {
    return <FullPageSpinner message="Loading your dashboard..." />;
  }

  // If there is no session user (edge-safety), render nothing.
  if (!session?.user) {
    return null;
  }

  // ---------------- Links ----------------
  // Centralised route paths for internal navigation.
  // These are used with Next.js <Link> for efficient client-side routing.
  const LINKS = {
    continueLearning: "/dashboard/course",
    exploreMap: "/dashboard/map",
    resources: "/dashboard/cultural-resources",
    manageStaff: "/dashboard/staff",
    billing: "/dashboard/billing",
    adminPanel: "/dashboard/admin",
    getAccess: "/dashboard/upgrade",
    // ✅ New route for the dedicated account deletion page
    deleteAccount: "/dashboard/delete-account",
  };

  // ---------------- Greeting ----------------
  // Animated greeting text using the existing TextType component.
  const greeting = (
    <TextType
      text={["JINGELA!"]}
      typingSpeed={75}
      pauseDuration={1500}
      showCursor={true}
      cursorCharacter="|"
    />
  );

  // ---------------- Layout ----------------
  // Layout grid:
  //  - Div 1: main hero panel
  //  - Div 2: quick actions (top-right)
  //  - Div 3: cultural highlight (bottom-left, 3 columns wide)
  //  - Div 4: learning / delete account panel (bottom-right, 2 columns wide)
  return (
    <div
      className="
        grid grid-cols-1 md:grid-cols-5 grid-rows-5
        gap-6 sm:gap-8
        p-4 sm:p-6 lg:p-10
        min-h-screen
        bg-linear-to-br from-slate-900 via-blue-950 to-blue-900
      "
    >
      {/* Div 1 — Main Content */}
      <div className="col-span-1 md:col-span-3 row-span-2 flex items-center justify-center">
        <section
          className="
            w-full h-full
            flex flex-col items-center justify-center text-center
            rounded-2xl shadow-2xl
            bg-linear-to-b from-blue-700 to-blue-300
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
          <h2 className="text-2xl font-bold text-blue-900 mb-4">
            Quick Actions
          </h2>
          <p className="text-sm text-gray-600 mb-6 text-center max-w-md">
            Continue your learning or explore key areas at your own pace.
          </p>

          {/* 
            Main action buttons.
            Switched from <a> to <Link> for internal navigation to use
            Next.js client-side routing (better performance and UX).
          */}
          <div className="w-full flex flex-col sm:flex-row gap-4 justify-center">
            {effectiveHasAccess ? (
              <>
                <Link
                  href={LINKS.continueLearning}
                  className="flex-1 text-center bg-slate-800/90 hover:bg-slate-800 text-white font-semibold px-6 py-3 rounded-xl shadow transition-transform hover:scale-[1.02]"
                >
                  Continue Learning
                </Link>
                <Link
                  href={LINKS.exploreMap}
                  className="flex-1 text-center bg-slate-800/90 hover:bg-slate-800 text-white font-semibold px-6 py-3 rounded-xl shadow transition-transform hover:scale-[1.02]"
                >
                  Explore Map
                </Link>
              </>
            ) : (
              <Link
                href={LINKS.getAccess}
                className="flex-1 text-center bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-xl shadow transition-transform hover:scale-[1.02]"
              >
                Get Access
              </Link>
            )}
          </div>

          {/* Secondary action for cultural resources */}
          <div className="w-full mt-4">
            <Link
              href={LINKS.resources}
              className="block text-center bg-yellow-500 hover:bg-yellow-400 text-white font-semibold px-6 py-3 rounded-xl shadow transition-transform hover:scale-[1.02]"
            >
              Cultural Resources
            </Link>
          </div>

          {/* Owner/Admin only actions remain unchanged logically, but use <Link> now */}
          {isOwnerOrAdmin && (
            <div className="w-full mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href={LINKS.manageStaff}
                className="text-center bg-rose-600 hover:bg-rose-500 text-white font-semibold px-4 py-2 rounded-lg shadow transition-transform hover:scale-[1.02]"
              >
                Manage Staff
              </Link>
              <Link
                href={LINKS.billing}
                className="text-center bg-rose-600 hover:bg-rose-500 text-white font-semibold px-4 py-2 rounded-lg shadow transition-transform hover:scale-[1.02]"
              >
                Billing
              </Link>
              {role === "ADMIN" && (
                <Link
                  href={LINKS.adminPanel}
                  className="text-center bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg shadow transition-transform hover:scale-[1.02] sm:col-span-2"
                >
                  Admin Panel
                </Link>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Div 3 — Cultural Highlight (moved here; content swapped with Div 4) */}
      <div className="col-span-1 md:col-span-3 row-span-3 row-start-auto md:row-start-3">
        <section className="h-full w-full flex flex-col items-center justify-center text-center rounded-2xl shadow-lg p-6 sm:p-8 bg-linear-to-br from-yellow-100 to-orange-100">
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Cultural Highlight
          </h2>
          {/* 
            We keep the rotating highlight behavior exactly the same
            and simply render it in this wider (3-column) panel.
          */}
          <p
            className="italic text-gray-700 leading-relaxed max-w-sm transition-opacity duration-500 ease-in-out"
            key={highlightIndex}
          >
            “{currentHighlight.quote}”
          </p>
          <p className="text-sm text-gray-600 mt-3">
            {currentHighlight.author}
          </p>
          <Link
            href={LINKS.resources}
            className="mt-5 inline-block text-gray-900 bg-yellow-300 hover:bg-yellow-200 px-5 py-2 rounded-lg font-semibold shadow transition-transform hover:scale-[1.02]"
          >
            Learn more
          </Link>
        </section>
      </div>

      {/* Div 4 — Learning / Account Deletion entry point */}
      <div className="col-span-1 md:col-span-2 row-span-3 col-start-auto md:col-start-4 row-start-auto md:row-start-3">
        <section className="h-full w-full flex flex-col items-center justify-center text-center bg-white/85 backdrop-blur-sm rounded-2xl shadow-lg p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-3">
            Learning & Account
          </h2>
          <p className="text-sm text-gray-700 max-w-sm">
            Manage your learning journey and, if needed, deactivate your
            account.
          </p>
          {/* 
            Red button for account deletion, following your requirement:
            - Red to signify destructive action.
            - Uses internal <Link /> to dedicated delete-account page.
          */}
          <Link
            href={LINKS.deleteAccount}
            className="mt-5 inline-block text-white bg-red-600 hover:bg-red-500 px-5 py-2 rounded-lg font-semibold shadow transition-transform hover:scale-[1.02]"
          >
            Delete Account
          </Link>
        </section>
      </div>
    </div>
  );
}









// // app/dashboard/page.tsx
// //
// // Purpose:
// // - Root dashboard landing page with visually polished main content (Div 1)
// //   plus three complementary panels:
// //     • Div 2: Quick Actions (role-aware, access-aware)
// //     • Div 3: Cultural Highlight (rotating quotes/facts)
// //     • Div 4: Learning (neutral panel; NO progress bar or progress logic)
// //
// // Important to this fix:
// // - Progress bar feature and all of its logic have been removed:
// //   • No CircularProgressbar import/usages
// //   • No animateTo helper
// //   • No progress/progressTarget state or effects
// //   • No /api/courses/* progress fetches
// // - All other flows/logic kept intact (auth, access checks, role, layout).
// //
// // Pillars:
// // - Simplicity & Robustness: clear separation of concerns.
// // - Security & Performance: same access checks as before; no new flows touched.

// "use client";

// import React, { useEffect, useMemo, useState } from "react";
// import { useSession } from "next-auth/react";
// import { useRouter } from "next/navigation";
// import Link from "next/link"; // ✅ Next.js client-side navigation for internal links

// import FullPageSpinner from "@/components/ui/fullPageSpinner";
// import TextType from "@/components/dashboard/TypingText";

// // PROGRESS BAR REMOVAL NOTES
// // ----------------------------
// // Removed:
// //   import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
// //   const COURSE_SLUG = "cultural-awareness-training";
// //   animateTo(...) helper
// //   progress/progressTarget state, refs, effects
// //   fetches for course id and /api/.../progress
// //   Progress Tracker panel content
// //
// // Kept:
// //   Session/access logic, quick actions, cultural highlights, layout grid.

// export default function DashboardPage() {
//   // ---------------- Session & Navigation ----------------
//   // Grab the authenticated session and auth status.
//   const { data: session, status } = useSession();
//   // Next.js app-router navigation hook.
//   const router = useRouter();

//   // ---------------- Derived Role Info ----------------
//   // Safely derive role and related flags from the session.
//   const role = session?.user?.role ?? "USER";
//   const businessId = session?.user?.businessId ?? null;
//   const sessionHasPaid = Boolean(session?.user?.hasPaid);

//   // Role helpers for clarity in the UI logic.
//   const isOwnerOrAdmin = role === "BUSINESS_OWNER" || role === "ADMIN";
//   const isStaffSeatUser = role === "USER" && businessId !== null; // kept for parity (not used elsewhere here)
//   const isIndividualUser = role === "USER" && businessId === null; // kept for parity

//   // ---------------- Server Access Probe ----------------
//   // This checks with the backend whether the user has access (e.g. payment state),
//   // independent of what the session says (extra robustness).
//   const [serverHasAccess, setServerHasAccess] = useState<boolean | null>(null);

//   useEffect(() => {
//     let cancelled = false;

//     const probe = async () => {
//       try {
//         // We explicitly avoid caching so the access state is always fresh.
//         const res = await fetch("/api/payments/check", { cache: "no-store" });
//         const data = await res.json();

//         if (!cancelled) {
//           // We only treat it as "has access" if the response is OK and the payload says so.
//           setServerHasAccess(Boolean(res.ok && data?.hasAccess));
//         }
//       } catch {
//         // On any error, we conservatively mark access as false (but do not crash).
//         if (!cancelled) setServerHasAccess(false);
//       }
//     };

//     probe();

//     // Cleanup flag to avoid updating state on an unmounted component.
//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   // ---------------- Rotating Cultural Highlights ----------------
//   // These are the rotating cultural quotes/facts shown in what is now Div 3.
//   const highlights = useMemo(
//     () => [
//       {
//         quote:
//           "When you know the Country, you know yourself. Everything is connected.",
//         author: "— Aunty Lorraine, Elder",
//       },
//       {
//         quote:
//           "Country is identity, law, and responsibility — not just a place.",
//         author: "— Community Teaching",
//       },
//       {
//         quote:
//           "Listening deeply means listening with the heart, not just the ears.",
//         author: "— Cultural Protocols",
//       },
//       {
//         quote:
//           "Reconciliation grows through respect, truth-telling, and action.",
//         author: "— Community Reminder",
//       },
//     ],
//     []
//   );

//   const [highlightIndex, setHighlightIndex] = useState(0);

//   useEffect(() => {
//     // Rotate the highlight every 10 seconds in a simple, robust way.
//     const id = setInterval(() => {
//       setHighlightIndex((i: number) => (i + 1) % highlights.length);
//     }, 10000);

//     // Clear interval on unmount to avoid memory leaks.
//     return () => clearInterval(id);
//   }, [highlights.length]);

//   const currentHighlight = highlights[highlightIndex];

//   // ---------------- Access Logic ----------------
//   // Effective access is determined by either role or payment/access flags.
//   const effectiveHasAccess =
//     isOwnerOrAdmin || sessionHasPaid || serverHasAccess === true;

//   // ---------------- Early Redirects ----------------
//   // If the user is unauthenticated, send them to login.
//   useEffect(() => {
//     if (status === "unauthenticated") {
//       router.push("/login");
//     }
//   }, [status, router]);

//   // While we don't yet know the auth status, show a full-page spinner.
//   if (status === "loading") {
//     return <FullPageSpinner message="Loading your dashboard..." />;
//   }

//   // If there is no session user (edge-safety), render nothing.
//   if (!session?.user) {
//     return null;
//   }

//   // ---------------- Links ----------------
//   // Centralised route paths for internal navigation.
//   // These are used with Next.js <Link> for efficient client-side routing.
//   const LINKS = {
//     continueLearning: "/dashboard/course",
//     exploreMap: "/dashboard/map",
//     resources: "/dashboard/resources",
//     manageStaff: "/dashboard/staff",
//     billing: "/dashboard/billing",
//     adminPanel: "/dashboard/admin",
//     getAccess: "/dashboard/upgrade",
//   };

//   // ---------------- Greeting ----------------
//   // Animated greeting text using the existing TextType component.
//   const greeting = (
//     <TextType
//       text={["JINGELA!"]}
//       typingSpeed={75}
//       pauseDuration={1500}
//       showCursor={true}
//       cursorCharacter="|"
//     />
//   );

//   // ---------------- Layout ----------------
//   // Layout grid:
//   //  - Div 1: main hero panel
//   //  - Div 2: quick actions (top-right)
//   //  - Div 3: cultural highlight (bottom-left, 3 columns wide)
//   //  - Div 4: learning panel (bottom-right, 2 columns wide)
//   return (
//     <div
//       className="
//         grid grid-cols-1 md:grid-cols-5 grid-rows-5
//         gap-6 sm:gap-8
//         p-4 sm:p-6 lg:p-10
//         min-h-screen
//         bg-linear-to-br from-slate-900 via-blue-950 to-blue-900
//       "
//     >
//       {/* Div 1 — Main Content */}
//       <div className="col-span-1 md:col-span-3 row-span-2 flex items-center justify-center">
//         <section
//           className="
//             w-full h-full
//             flex flex-col items-center justify-center text-center
//             rounded-2xl shadow-2xl
//             bg-linear-to-b from-blue-700 to-blue-300
//             p-8 sm:p-10 lg:p-12
//             text-white
//             transition-all duration-500 ease-in-out
//             hover:scale-[1.02] hover:shadow-blue-900/30
//           "
//         >
//           <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight drop-shadow-md">
//             {greeting}
//           </h1>

//           <p className="mt-6 text-lg sm:text-xl font-medium text-blue-100 tracking-wide">
//             Logged in as{" "}
//             <span className="font-bold text-white">{session.user.email}</span>
//           </p>
//           <p className="text-blue-100">Role: {role}</p>

//           <p className="mt-8 text-base sm:text-lg leading-relaxed max-w-2xl text-blue-50/90">
//             This is your personalised dashboard.
//             <br className="hidden sm:block" />
//             Use the navigation bar above to explore your tools and manage your
//             learning journey.
//           </p>
//         </section>
//       </div>

//       {/* Div 2 — Quick Actions */}
//       <div className="col-span-1 md:col-span-2 row-span-2 col-start-auto md:col-start-4">
//         <section
//           className="
//             h-full w-full
//             flex flex-col items-center justify-center
//             bg-white/85 backdrop-blur-sm
//             rounded-2xl shadow-lg hover:shadow-xl
//             p-6 sm:p-8
//             transition
//           "
//         >
//           <h2 className="text-2xl font-bold text-blue-900 mb-4">
//             Quick Actions
//           </h2>
//           <p className="text-sm text-gray-600 mb-6 text-center max-w-md">
//             Continue your learning or explore key areas at your own pace.
//           </p>

//           {/* 
//             Main action buttons.
//             Switched from <a> to <Link> for internal navigation to use
//             Next.js client-side routing (better performance and UX).
//           */}
//           <div className="w-full flex flex-col sm:flex-row gap-4 justify-center">
//             {effectiveHasAccess ? (
//               <>
//                 <Link
//                   href={LINKS.continueLearning}
//                   className="flex-1 text-center bg-slate-800/90 hover:bg-slate-800 text-white font-semibold px-6 py-3 rounded-xl shadow transition-transform hover:scale-[1.02]"
//                 >
//                   Continue Learning
//                 </Link>
//                 <Link
//                   href={LINKS.exploreMap}
//                   className="flex-1 text-center bg-slate-800/90 hover:bg-slate-800 text-white font-semibold px-6 py-3 rounded-xl shadow transition-transform hover:scale-[1.02]"
//                 >
//                   Explore Map
//                 </Link>
//               </>
//             ) : (
//               <Link
//                 href={LINKS.getAccess}
//                 className="flex-1 text-center bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-xl shadow transition-transform hover:scale-[1.02]"
//               >
//                 Get Access
//               </Link>
//             )}
//           </div>

//           {/* Secondary action for cultural resources */}
//           <div className="w-full mt-4">
//             <Link
//               href={LINKS.resources}
//               className="block text-center bg-yellow-500 hover:bg-yellow-400 text-white font-semibold px-6 py-3 rounded-xl shadow transition-transform hover:scale-[1.02]"
//             >
//               Cultural Resources
//             </Link>
//           </div>

//           {/* Owner/Admin only actions remain unchanged logically, but use <Link> now */}
//           {isOwnerOrAdmin && (
//             <div className="w-full mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
//               <Link
//                 href={LINKS.manageStaff}
//                 className="text-center bg-rose-600 hover:bg-rose-500 text-white font-semibold px-4 py-2 rounded-lg shadow transition-transform hover:scale-[1.02]"
//               >
//                 Manage Staff
//               </Link>
//               <Link
//                 href={LINKS.billing}
//                 className="text-center bg-rose-600 hover:bg-rose-500 text-white font-semibold px-4 py-2 rounded-lg shadow transition-transform hover:scale-[1.02]"
//               >
//                 Billing
//               </Link>
//               {role === "ADMIN" && (
//                 <Link
//                   href={LINKS.adminPanel}
//                   className="text-center bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg shadow transition-transform hover:scale-[1.02] sm:col-span-2"
//                 >
//                   Admin Panel
//                 </Link>
//               )}
//             </div>
//           )}
//         </section>
//       </div>

//       {/* Div 3 — Cultural Highlight (moved here; content swapped with Div 4) */}
//       <div className="col-span-1 md:col-span-3 row-span-3 row-start-auto md:row-start-3">
//         <section className="h-full w-full flex flex-col items-center justify-center text-center rounded-2xl shadow-lg p-6 sm:p-8 bg-linear-to-br from-yellow-100 to-orange-100">
//           <h2 className="text-xl font-bold text-gray-800 mb-2">
//             Cultural Highlight
//           </h2>
//           {/* 
//             We keep the rotating highlight behavior exactly the same
//             and simply render it in this wider (3-column) panel.
//           */}
//           <p
//             className="italic text-gray-700 leading-relaxed max-w-sm transition-opacity duration-500 ease-in-out"
//             key={highlightIndex}
//           >
//             “{currentHighlight.quote}”
//           </p>
//           <p className="text-sm text-gray-600 mt-3">
//             {currentHighlight.author}
//           </p>
//           <Link
//             href={LINKS.resources}
//             className="mt-5 inline-block text-gray-900 bg-yellow-300 hover:bg-yellow-200 px-5 py-2 rounded-lg font-semibold shadow transition-transform hover:scale-[1.02]"
//           >
//             Learn more
//           </Link>
//         </section>
//       </div>

//       {/* Div 4 — Learning (moved here; content swapped with Div 3) */}
//       <div className="col-span-1 md:col-span-2 row-span-3 col-start-auto md:col-start-4 row-start-auto md:row-start-3">
//         <section className="h-full w-full flex flex-col items-center justify-center text-center bg-white/85 backdrop-blur-sm rounded-2xl shadow-lg p-6 sm:p-8">
//           <h2 className="text-2xl font-bold text-blue-900 mb-3">Learning</h2>
//           <p className="text-sm text-gray-700 max-w-sm">
//             Pick up where you left off, or review earlier modules at any time.
//           </p>
//           <Link
//             href={LINKS.continueLearning}
//             className="mt-5 inline-block text-white bg-red-600 hover:bg-red-500 px-5 py-2 rounded-lg font-semibold shadow transition-transform hover:scale-[1.02]"
//           >
//             Delete Account
//           </Link>
//         </section>
//       </div>
//     </div>
//   );
// }


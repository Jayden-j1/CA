// app/dashboard/layout.tsx
//
// Purpose:
// - Layout wrapper for all *dashboard* pages (protected area).
// - Adds Suspense boundaries at the layout level so ANY child component
//   that uses `useSearchParams()` is safely suspended during hydration.
//   This resolves the Vercel build error:
//   "useSearchParams() should be wrapped in a suspense boundary".
//
// Why Suspense here (in addition to page-level Suspense)?
// - The dashboard navbar or any shared component rendered by this layout
//   might use `useSearchParams()` now or in the future. Because the layout
//   renders *above* the page, page-level <Suspense> cannot cover those.
// - Placing <Suspense> here guarantees coverage for:
//     • <DashboardNavbar /> (top bar shared on all dashboard routes)
//     • <main>{children}</main> (all dashboard pages)
//
// Pillars implemented:
// - Efficiency: lightweight fallback UI (skeleton) avoids heavy work.
// - Robustness: even if future components add `useSearchParams`, we’re safe.
// - Simplicity: a single shared fix in the layout, no scattering.
// - Ease of management: one place to maintain.
// - Security: unchanged; auth/role gating still handled elsewhere.
//
// Notes:
// - We do NOT change your existing business logic.
// - We keep the existing import path for your navbar component.

"use client";

import { ReactNode, Suspense } from "react";
import DashboardNavbar from "@/components/dashboard/DashBoardNav";

// --------- Tiny, fast fallbacks to avoid layout shift ----------

// Skeleton bar shown while the navbar suspends (usually very brief)
function NavbarSkeleton() {
  return (
    <div className="bg-white border-b border-gray-200 shadow-sm px-4 py-3">
      <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
    </div>
  );
}

// Content area fallback (simple and neutral)
function MainSkeleton() {
  return (
    <main className="flex-1 p-6 bg-gray-100">
      <div className="h-6 w-64 bg-gray-200 rounded animate-pulse mb-4" />
      <div className="h-40 w-full bg-gray-200 rounded animate-pulse" />
    </main>
  );
}

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* ✅ Suspense for anything the navbar might do (e.g., useSearchParams) */}
      <Suspense fallback={<NavbarSkeleton />}>
        {/* Dashboard-only navbar (config-driven + role/pay aware) */}
        <DashboardNavbar />
      </Suspense>

      {/* ✅ Suspense for all page content under /dashboard */}
      <Suspense fallback={<MainSkeleton />}>
        <main className="flex-1 p-6 bg-gray-100">{children}</main>
      </Suspense>

      {/* Minimal dashboard footer (unchanged) */}
      <footer className="bg-white border-t border-gray-200 py-3 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Cultural Awareness App · Dashboard
      </footer>
    </div>
  );
}







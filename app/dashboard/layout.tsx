// app/dashboard/layout.tsx
//
// Purpose:
// - Layout wrapper for all *dashboard* pages (protected area).
// - ✅ Uses the dedicated DashboardNavbar (role-aware, with staff-seat Billing rules).
// - Excludes the public navbar and footer (no stacking).
// - Adds an optional minimal dashboard footer (customizable later).
//
// Why update?
// - Previously, this file imported a DashboardNavbar from the *public header* module,
//   which didn’t include the latest “hide Billing for staff-seat” rules.
// - We now import the correct navbar from components/dashboard/DashboardNavbar.

"use client";

import { ReactNode } from "react";
// ✅ Import the correct dashboard navbar (default export)
import DashboardNavbar from "@/components/dashboard/DashBoardNav";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* ✅ Dashboard-only navbar (role-aware + staff-seat filtering) */}
      <DashboardNavbar />

      {/* ✅ Main content area */}
      <main className="flex-1 p-6 bg-gray-100">{children}</main>

      {/* ✅ Minimal dashboard footer (optional) */}
      <footer className="bg-white border-t border-gray-200 py-3 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Cultural Awareness App · Dashboard
      </footer>
    </div>
  );
}

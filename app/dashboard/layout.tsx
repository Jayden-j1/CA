// app/dashboard/layout.tsx
//
// Purpose:
// - Layout wrapper for all *dashboard* pages (protected area).
// - Uses the centralized, config-driven DashboardNavbar.
// - Excludes the public navbar and footer (no stacking).
// - Adds an optional minimal dashboard footer (customizable later).
//
// Notes:
// - This ensures the dashboard feels like a self-contained app.
// - IMPORTANT: We import from "@/components/dashboard/DashboardNav"
//   so we use the correct Navbar that consumes config/navigation.ts.

"use client";

import { ReactNode } from "react";
import DashboardNavbar from "@/components/dashboard/DashBoardNav";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* ✅ Dashboard-only navbar (config-driven + role/pay aware) */}
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

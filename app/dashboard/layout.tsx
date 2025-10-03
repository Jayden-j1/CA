// app/dashboard/layout.tsx
//
// Purpose:
// - Layout wrapper for all *dashboard* pages (protected area).
// - Uses the centralized, config-driven DashboardNavbar (the one that
//   reads role/payment-aware nav rules from config/navigation.ts).
//
// Key fix in this version:
// - Import the **correct** DashboardNavbar (named export) from Header/NavBar.
//   Previously this layout pointed to a different component path, so any
//   improvements to Header/NavBar were not reflected in the dashboard UI.

"use client";

import { ReactNode } from "react";
// ✅ Use the named export from Header/NavBar (this is the one you shared)
import { DashboardNavbar } from "@/components/Header/NavBar";

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

// components/Header/NavBar.tsx
//
// Purpose:
// - Shared Navbar for both public and dashboard contexts.
// - Handles route highlighting, logout, and live nav updates after payments.
//
// Key Fixes (2025-10):
// 1. ✅ Null-safe useSearchParams() via optional chaining and fallback.
// 2. ✅ Safe pathname comparison (pathname ?? "") to avoid TS warnings.
// 3. ✅ Preserve correct property: `item.name` (not `label`).
// 4. ✅ Maintain all behavior: session-aware filtering, responsive UI.
//
// Pillars applied:
// - Efficiency: Single-pass polling, minimal renders.
// - Robustness: Build-proof under Next.js 15’s strict type checking.
// - Simplicity: Original structure untouched, only type-safe guards added.
// - Ease of Management: Comments + clear defensive improvements.
// - Security: Sign-out callback remains safe and explicit.
//

'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  publicNavigation,
  dashboardNavigation,
  NavItem,
  filterDashboardNavigation,
} from "@/config/navigation";

// ---------------------------------------------------------
// BaseNavbar: Presentational component for any nav list
// ---------------------------------------------------------
const BaseNavbar: React.FC<{ navItems: NavItem[] }> = ({ navItems }) => {
  const [isOpen, setIsOpen] = useState(false);

  // ✅ Safe pathname access (may be null during prerender)
  const pathname = usePathname() ?? "";

  // Split items for left/right alignment
  const leftItems = navItems.filter((item) => item.align !== "right");
  const rightItems = navItems.filter((item) => item.align === "right");

  // ---------------------------------------------------------
  // Intercept Logout → signOut() with friendly redirect toast
  // ---------------------------------------------------------
  const handleMaybeLogout = async (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (href !== "/logout") return;
    e.preventDefault();
    const base = window.location.origin;
    const callbackUrl = `${base}/?logout=success`;
    await signOut({ callbackUrl });
  };

  // ---------------------------------------------------------
  // Render: Desktop & Mobile versions unified
  // ---------------------------------------------------------
  return (
    <header>
      <nav className="relative bg-white border-gray-200 shadow-sm px-4 py-3 flex items-center justify-between">
        {/* Left-aligned links (desktop) */}
        <div className="hidden lg:flex space-x-6 items-center">
          {leftItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={(e) => handleMaybeLogout(e, item.href)}
              className={`px-4 py-2 font-bold rounded transition-colors duration-200 ${
                pathname === item.href
                  ? "bg-blue-500 text-white"
                  : "text-gray-700 hover:text-white hover:bg-blue-500"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Right-aligned links (desktop) */}
        <div className="hidden lg:flex space-x-6 items-center ml-auto">
          {rightItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={(e) => handleMaybeLogout(e, item.href)}
              className={`px-4 py-2 font-bold rounded transition-colors duration-200 ${
                pathname === item.href
                  ? "bg-blue-500 text-white"
                  : "text-gray-700 hover:text-white hover:bg-blue-500"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Mobile hamburger toggle */}
        <div>
          <button
            onClick={() => setIsOpen((open) => !open)}
            className="lg:hidden px-3 py-2 text-gray-700 border border-gray-300 rounded"
            aria-label="Toggle menu"
          >
            ☰
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {isOpen && (
          <div className="absolute top-full left-0 w-full lg:hidden px-4 pb-4 space-y-1 bg-white shadow z-50">
            {navItems.map((item) => (
              <div key={item.name} onClick={() => setIsOpen(false)}>
                <Link
                  href={item.href}
                  onClick={(e) => handleMaybeLogout(e, item.href)}
                  className={`block py-3 px-4 rounded font-bold transition-colors duration-200 ${
                    pathname === item.href
                      ? "bg-blue-500 text-white"
                      : "text-gray-700 hover:text-blue-600 hover:bg-gray-100"
                  }`}
                >
                  {item.name}
                </Link>
              </div>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
};

// ---------------------------------------------------------
// Public Navbar (for non-authenticated routes)
// ---------------------------------------------------------
export const PublicNavbar: React.FC = () => (
  <BaseNavbar navItems={publicNavigation} />
);

// ---------------------------------------------------------
// Dashboard Navbar (role/payment-aware dynamic nav)
// ---------------------------------------------------------
export const DashboardNavbar: React.FC = () => {
  const { data: session, status } = useSession();

  // ✅ Null-safe searchParams (prevents Vercel build crash)
  const searchParams = useSearchParams();
  const justSucceeded = (searchParams?.get("success") ?? "") === "true";

  const role = session?.user?.role;
  const businessId = session?.user?.businessId ?? null;
  const sessionHasPaid = Boolean(session?.user?.hasPaid);

  // Track server-confirmed access to update nav faster than token refresh
  const [serverHasAccess, setServerHasAccess] = useState<boolean | null>(null);

  // ---------------------------------------------------------
  // Lightweight polling: after Stripe success, wait for webhook
  // ---------------------------------------------------------
  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const maxAttempts = justSucceeded ? 8 : 1; // ~12s polling window
    const intervalMs = 1500;

    const probe = async () => {
      try {
        const res = await fetch("/api/payments/check", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setServerHasAccess(Boolean(res.ok && data?.hasAccess));
      } catch {
        if (!cancelled) setServerHasAccess(false);
      } finally {
        attempts += 1;
        if (!cancelled && attempts < maxAttempts && serverHasAccess !== true) {
          timer = setTimeout(probe, intervalMs);
        }
      }
    };

    probe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, justSucceeded]);

  // Effective "paid" status combines session + server truth
  const effectiveHasPaid = sessionHasPaid || serverHasAccess === true;

  // Nav loading state (hides items that opt into hideWhileLoading)
  const isLoading =
    status === "loading" ||
    (status === "authenticated" && serverHasAccess === null);

  // Apply filtering rules for dashboard navigation
  const filtered = filterDashboardNavigation({
    navigation: dashboardNavigation,
    role,
    businessId,
    hasPaid: effectiveHasPaid,
    isLoading,
  });

  return <BaseNavbar navItems={filtered} />;
};

export default BaseNavbar;

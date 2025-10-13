// components/dashboard/DashboardNav.tsx
//
// Purpose:
// - Config-driven dashboard navigation.
//
// Why these fixes?
// - Next.js App Router + TypeScript can type `useSearchParams()` and `usePathname()`
//   as possibly `null` during certain build/SSR phases.
// - Making both calls null-safe removes Vercel build crashes while keeping
//   your logic 100% unchanged.
//
// Behavior retained:
// - Trusts a lightweight server probe `/api/payments/check` to flip the nav
//   quickly after Stripe webhook (before the NextAuth token refresh).
// - If landing with ?success=true, it polls a few times to reflect payment ASAP.
// - Filters items via filterDashboardNavigation (role, businessId, paid state).
//
// Pillars:
// - Efficiency: short polling window only on success; single probe otherwise.
// - Robustness: null-safe URL hooks; no flicker while loading.
// - Simplicity: original structure preserved; comments added.
// - Security: no client mutations; server remains source of truth for access.

"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  NavItem,
  filterDashboardNavigation,
  Role,
} from "@/config/navigation";

interface NavbarProps {
  navigation?: NavItem[];
}

const DashboardNavbar: React.FC<NavbarProps> = ({ navigation }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // ✅ Null-safe: `usePathname()` may be `null` during prerender/hydration.
  // We coerce to empty string for stable comparisons.
  const pathname = usePathname() ?? "";

  const { data: session, status } = useSession();
  const role = session?.user?.role as Role | undefined;
  const businessId = session?.user?.businessId || null;
  const sessionHasPaid = Boolean(session?.user?.hasPaid);

  // ---- Authoritative server truth (fast nav update after webhook)
  const [serverHasAccess, setServerHasAccess] = useState<boolean | null>(null);

  // ✅ Null-safe: `useSearchParams()` may be unavailable momentarily in some builds.
  // Optional chaining + fallback prevents "possibly null" errors in CI/Vercel.
  const searchParams = useSearchParams();
  const justSucceeded = (searchParams?.get("success") ?? "") === "true";

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // If we return from Stripe with ?success=true, poll briefly so the nav
    // flips from "Upgrade" → "Billing" as soon as the webhook lands.
    const maxAttempts = justSucceeded ? 6 : 1; // ~9s window (6 * 1.5s) on success; single probe otherwise
    const intervalMs = 1500;
    let attempts = 0;

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
  }, [status, justSucceeded]); // omit `serverHasAccess` to avoid re-arming the loop

  // Effective paid state for nav decisions
  const effectiveHasPaid = sessionHasPaid || serverHasAccess === true;

  // Hide sensitive links while session/probe are loading to avoid flicker
  const isLoading =
    status === "loading" ||
    (status === "authenticated" && serverHasAccess === null);

  const navItems = useMemo<NavItem[]>(
    () =>
      filterDashboardNavigation({
        navigation,
        role,
        businessId,
        hasPaid: effectiveHasPaid,
        isLoading,
      }),
    [navigation, role, businessId, effectiveHasPaid, isLoading]
  );

  const leftItems = navItems.filter((item) => item.align !== "right");
  const rightItems = navItems.filter((item) => item.align === "right");

  return (
    <header>
      <nav className="relative bg-white border-gray-200 shadow-sm">
        {/* Desktop */}
        <div className="hidden lg:flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-6">
            {leftItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
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

          <div className="flex items-center space-x-6">
            {rightItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
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
        </div>

        {/* Mobile Toggle */}
        <div className="px-4 py-3 lg:hidden">
          <button
            onClick={() => setIsOpen((open) => !open)}
            className="px-3 py-2 text-gray-700 border border-gray-300 rounded"
            aria-label="Toggle menu"
            aria-expanded={isOpen}
          >
            ☰
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="absolute z-50 w-full lg:hidden px-4 pb-4 space-y-1 bg-white shadow">
            {navItems.map((item) => (
              <div key={item.name} onClick={() => setIsOpen(false)}>
                <Link
                  href={item.href}
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

export default DashboardNavbar;

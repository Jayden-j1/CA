// components/Header/NavBar.tsx
//
// Purpose:
// - Shared Navbar for public + dashboard.
// - DashboardNavbar delegates visibility to filterDashboardNavigation()
//   so that "Upgrade" hides when paid and "Billing" appears for paid individuals
//   and for owners/admins.
// - Adds a lightweight server confirmation (`/api/payments/check`) so nav updates
//   even before NextAuth session token refreshes post-webhook.
//
// Key updates in this version:
// - Compute `effectiveHasPaid = session.user.hasPaid || serverHasAccess`.
// - When landing on /dashboard?success=true, poll the check briefly to avoid
//   showing “Upgrade” and to reveal “Billing” ASAP once webhook writes Payment.
// - While loading, we use hideWhileLoading in nav config to avoid flicker.

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
// BaseNavbar: Presentational component
// ---------------------------------------------------------
const BaseNavbar: React.FC<{ navItems: NavItem[] }> = ({ navItems }) => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const leftItems = navItems.filter((item) => item.align !== "right");
  const rightItems = navItems.filter((item) => item.align === "right");

  // Intercept Logout → call NextAuth.signOut with callbackUrl (for a friendly toast)
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

  return (
    <header>
      <nav className="relative bg-white border-gray-200 shadow-sm px-4 py-3 flex items-center justify-between">
        {/* Desktop left-aligned items */}
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

        {/* Desktop right-aligned items */}
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

        {/* Mobile menu */}
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
// Public Navbar
// ---------------------------------------------------------
export const PublicNavbar: React.FC = () => (
  <BaseNavbar navItems={publicNavigation} />
);

// ---------------------------------------------------------
// Dashboard Navbar (role/payment-aware)
// ---------------------------------------------------------
export const DashboardNavbar: React.FC = () => {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();

  const role = session?.user?.role;
  const businessId = session?.user?.businessId ?? null;
  const sessionHasPaid = Boolean(session?.user?.hasPaid);

  // ——— Lightweight server truth for nav (so we don't wait for session refresh)
  const [serverHasAccess, setServerHasAccess] = useState<boolean | null>(null);

  // If landing with success=true post-checkout, poll briefly so nav reflects payment as soon as webhook lands.
  const justSucceeded = searchParams.get("success") === "true";

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const maxAttempts = justSucceeded ? 8 : 1; // ~12s if just succeeded (8 * 1.5s), else single probe
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
  }, [status, justSucceeded]); // intentionally omit serverHasAccess to avoid rearming the poll loop

  // Effective hasPaid for nav decisions:
  // - trusts either the session (fast) OR the server check (authoritative)
  const effectiveHasPaid = sessionHasPaid || serverHasAccess === true;

  // Loading state for nav items that opt-into hideWhileLoading
  const isLoading =
    status === "loading" ||
    (status === "authenticated" && serverHasAccess === null);

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

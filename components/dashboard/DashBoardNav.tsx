// components/dashboard/DashboardNav.tsx
//
// Purpose
// -------
// Config-driven dashboard nav that reacts quickly to Stripe success:
// - Reads session.user.hasPaid
// - Probes /api/payments/check after ?success=true to flip quickly
// - Filters items via your existing filterDashboardNavigation()
// - Hides "Upgrade" when access is granted
//
// NOTE
// ----
// This file assumes you have filterDashboardNavigation() configured
// to omit Upgrade for paid users and hide Staff/Billing from staff roles.

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

  // Null-safe pathname (prevents build-time null issues)
  const pathname = usePathname() ?? "";

  const { data: session, status } = useSession();
  const role = session?.user?.role as Role | undefined;
  const businessId = session?.user?.businessId || null;
  const sessionHasPaid = Boolean(session?.user?.hasPaid);

  // Server probe flips quickly after webhook → DB
  const [serverHasAccess, setServerHasAccess] = useState<boolean | null>(null);

  const searchParams = useSearchParams();
  const justSucceeded = (searchParams?.get("success") ?? "") === "true";

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const maxAttempts = justSucceeded ? 6 : 1; // brief polling window after success
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
  }, [status, justSucceeded]);

  const effectiveHasPaid = sessionHasPaid || serverHasAccess === true;

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

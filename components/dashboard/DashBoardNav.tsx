// components/dashboard/DashboardNav.tsx
//
// Purpose:
// - Dashboard Navbar that is 100% config-driven.
// - It does not hardcode any business rules; instead, it delegates to
//   filterDashboardNavigation(...) from config/navigation.ts.
// - NEW: Split desktop nav into *left* and *right* groups using `item.align`
//   so "Logout" is always rendered at the far right.
//
// Why this approach?
// - Single source of truth for visibility (config/navigation.ts).
// - Zero-code changes for business rules (toggle flags in config).
// - This component focuses only on layout + calling the filter helper.
//
// UX details:
// - While NextAuth session is hydrating (status === "loading"), we render a
//   conservative set (filter hides session-dependent items to prevent flicker).
// - We use useMemo to avoid unnecessary re-renders.
// - Desktop: left + right groups. Mobile: a flat menu (Logout will appear in
//   the same list order, which is acceptable for small screens).

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  NavItem,
  filterDashboardNavigation,
  Role,
} from "@/config/navigation";

interface NavbarProps {
  // Optional: you can override the config navigation from outside,
  // but usually you let filterDashboardNavigation use its default.
  navigation?: NavItem[];
}

const DashboardNavbar: React.FC<NavbarProps> = ({ navigation }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const pathname = usePathname();

  // We read the session to get role / businessId / hasPaid flags:
  //  - status === "loading": NextAuth hasn't finished hydrating session on the client.
  const { data: session, status } = useSession();
  const role = session?.user?.role as Role | undefined;
  const businessId = session?.user?.businessId || null;
  const hasPaid = Boolean(session?.user?.hasPaid);
  const isLoading = status === "loading";

  // Ask the central filter to compute the final list based on flags.
  const navItems = useMemo<NavItem[]>(
    () =>
      filterDashboardNavigation({
        navigation,
        role,
        businessId,
        hasPaid,
        isLoading,
      }),
    [navigation, role, businessId, hasPaid, isLoading]
  );

  // Split items into left vs right for desktop layout
  const leftItems = navItems.filter((item) => item.align !== "right");
  const rightItems = navItems.filter((item) => item.align === "right");

  return (
    <header>
      <nav className="relative bg-white border-gray-200 shadow-sm">
        {/* =======================
             Desktop Navigation
           ======================= */}
        <div className="hidden lg:flex items-center justify-between px-4 py-3">
          {/* LEFT group: Home, Map, Course, etc. */}
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

          {/* RIGHT group: Logout (and any other future right-aligned items) */}
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

        {/* =======================
             Mobile Toggle Button
           ======================= */}
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

        {/* =======================
             Mobile Menu
           ======================= */}
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

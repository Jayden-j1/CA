// components/dashboard/DashboardNav.tsx
//
// Purpose:
// - Dashboard Navbar that is 100% config-driven.
// - It does not hardcode any business rules (e.g., Billing/Upgrade logic).
// - Instead, it calls `filterDashboardNavigation(...)` from config/navigation.ts,
//   which is the single source of truth.
//
// Why this approach?
// - Changes to visibility (e.g., hide Billing for staff seat) only require
//   flipping flags in config/navigation.ts — no component edits.
// - Fewer conditionals here, more predictable behavior.
// - Easier to test: we unit-test the filter function to validate scenarios.
//
// UX details:
// - While NextAuth session is hydrating (status === "loading"), we render a
//   conservative set (the filter hides session-dependent items to prevent flicker).
// - We use useMemo to avoid unnecessary re-renders.

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
  navigation?: NavItem[]; // optional override; defaults to config's dashboardNavigation inside filter
}

const DashboardNavbar: React.FC<NavbarProps> = ({ navigation }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const pathname = usePathname();

  // NextAuth session: read role, hasPaid, businessId, and whether session is loading
  const { data: session, status } = useSession();
  const role = session?.user?.role as Role | undefined;
  const businessId = session?.user?.businessId || null;
  const hasPaid = Boolean(session?.user?.hasPaid);
  const isLoading = status === "loading";

  // Compute the filtered nav items based on the centralized rules
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

  return (
    <header>
      <nav className="relative bg-white border-gray-200 shadow-sm">
        {/* Desktop navigation */}
        <div className="hidden lg:flex space-x-6 items-center px-4 py-3">
          {navItems.map((item) => (
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

        {/* Mobile hamburger toggle */}
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

        {/* Mobile menu */}
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

// components/Header/NavBar.tsx
//
// Purpose:
// - Shared Navbar for public + dashboard.
// - DashboardNavbar filters links by role and hides “Upgrade” if user.hasPaid.
// - Intercepts Logout → calls NextAuth.signOut with callbackUrl for toast.
//
// Notes:
// - Upgrade hiding logic is client-side via session.user.hasPaid.
// - Role-based checks are respected via config/navigation.ts.

'use client';

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  publicNavigation,
  dashboardNavigation,
  NavItem,
} from "@/config/navigation";

// -------------------------
// BaseNavbar: presentational
// -------------------------
const BaseNavbar: React.FC<{ navItems: NavItem[] }> = ({ navItems }) => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const leftItems = navItems.filter((item) => item.align !== "right");
  const rightItems = navItems.filter((item) => item.align === "right");

  // Intercept logout clicks
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
        {/* Desktop left */}
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

        {/* Desktop right */}
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

        {/* Mobile hamburger */}
        <div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden px-3 py-2 text-gray-700 border border-gray-300 rounded"
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

// -------------------------
// Public Navbar
// -------------------------
export const PublicNavbar: React.FC = () => (
  <BaseNavbar navItems={publicNavigation} />
);

// -------------------------
// Dashboard Navbar
// -------------------------
// Filters by role & hides Upgrade if user.hasPaid
// -------------------------
export const DashboardNavbar: React.FC = () => {
  const { data: session } = useSession();

  const role = session?.user?.role;
  const hasPaid = session?.user?.hasPaid;

  const filtered = dashboardNavigation.filter((item) => {
    if (item.name === "Upgrade" && hasPaid) return false;

    if (!item.requiresRole) return true;
    if (typeof item.requiresRole === "string") {
      return item.requiresRole === role;
    }
    if (Array.isArray(item.requiresRole)) {
      return item.requiresRole.includes(role as any);
    }
    return false;
  });

  return <BaseNavbar navItems={filtered} />;
};

export default BaseNavbar;

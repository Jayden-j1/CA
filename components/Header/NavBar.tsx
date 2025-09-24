'use client';

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  publicNavigation,
  dashboardNavigation,
  NavItem,
} from "@/config/navigation";

// -------------------------------------------------------
// Shared Navbar component
// -------------------------------------------------------
// - Accepts a list of navItems (already filtered).
// - Handles alignment (left/right) for desktop.
// - Collapses into hamburger menu for mobile.
// -------------------------------------------------------
const BaseNavbar: React.FC<{ navItems: NavItem[] }> = ({ navItems }) => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Split into left vs right-aligned items
  const leftItems = navItems.filter((item) => item.align !== "right");
  const rightItems = navItems.filter((item) => item.align === "right");

  return (
    <header>
      <nav className="relative bg-white border-gray-200 shadow-sm px-4 py-3 flex items-center justify-between">
        {/* ---------------------------
            Desktop Navigation (left)
        --------------------------- */}
        <div className="hidden lg:flex space-x-6 items-center">
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

        {/* ---------------------------
            Desktop Navigation (right)
        --------------------------- */}
        <div className="hidden lg:flex space-x-6 items-center ml-auto">
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

        {/* ---------------------------
            Mobile Hamburger Menu
        --------------------------- */}
        <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="lg:hidden px-3 py-2 text-gray-700 border border-gray-300 rounded"
        >
          ☰
        </button>
        </div>

        {/* ---------------------------
            Mobile Navigation (all items stacked)
        --------------------------- */}
        {isOpen && (
          <div className="absolute top-full left-0 w-full lg:hidden px-4 pb-4 space-y-1 bg-white shadow z-50">
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

// -------------------------------------------------------
// Public Navbar
// -------------------------------------------------------
// - Always shows publicNavigation
// -------------------------------------------------------
export const PublicNavbar: React.FC = () => {
  return <BaseNavbar navItems={publicNavigation} />;
};

// -------------------------------------------------------
// Dashboard Navbar
// -------------------------------------------------------
// - Shows dashboardNavigation
// - Filters items based on user role
// -------------------------------------------------------
export const DashboardNavbar: React.FC = () => {
  const { data: session } = useSession();
  const role = session?.user?.role; // e.g. "USER", "BUSINESS_OWNER", "ADMIN"

  // Apply role-based filtering
  const filteredNav = dashboardNavigation.filter((item) => {
    if (!item.requiresRole) return true;

    if (typeof item.requiresRole === "string") {
      return item.requiresRole === role;
    }

    if (Array.isArray(item.requiresRole)) {
      return item.requiresRole.includes(role as any);
    }

    return false;
  });

  return <BaseNavbar navItems={filteredNav} />;
};




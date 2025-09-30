// components/dashboard/DashboardNav.tsx
//
// Purpose:
// - Dashboard Navbar that filters navigation items by role and payment status.
// - Hides "Upgrade" if session.user.hasPaid === true.
// - Hides "Billing" for staff-seat users (role USER + businessId != null).
//   → Billing is only meant for:
//      • Individual users who paid directly (USER with no businessId and hasPaid = true)
//      • BUSINESS_OWNER
//      • ADMIN
//
// Improvements in this version:
// - ✅ Reads visibility hints from config/navigation.ts (visibility.hideForStaffSeat,
//   visibility.individualRequiresPaid) instead of hardcoding everything.
// - ✅ Uses `status === 'loading'` to prevent flicker while session hydrates.
// - ✅ Still applies role-based filtering and aligns with server-side route guard on /dashboard/billing.
//
// Why do both (navbar + route guard)?
// - Navbar = better UX (hide links users can't use).
// - API/Page guard = security (even if URL is typed manually, access is prevented).
//
// NOTE:
// - This component is specific to the dashboard and should be used only inside dashboard
//   layouts/pages. Public pages should use the public header navbar.

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { dashboardNavigation, NavItem } from "@/config/navigation";

// Optional prop to override navigation set (defaults to dashboardNavigation)
interface NavbarProps {
  navigation?: NavItem[];
}

const DashboardNavbar: React.FC<NavbarProps> = ({ navigation }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const pathname = usePathname();

  // We use `useSession` to read the authenticated user's session:
  // - `status === "loading"`: NextAuth hasn't hydrated the session yet on the client.
  //   We avoid rendering links that depend on session flags to prevent flicker.
  // - `data`: the session object holding `user.role`, `user.businessId`, `user.hasPaid`, etc.
  const { data: session, status } = useSession();

  // Extract role/payment flags used for filtering.
  const role = session?.user?.role;
  const businessId = session?.user?.businessId || null;
  const hasPaid = Boolean(session?.user?.hasPaid);

  // ------------------------------
  // Build final nav items list
  // ------------------------------
  // We compute this with useMemo so that the array doesn't change on every render unnecessarily.
  const navItems = useMemo<NavItem[]>(() => {
    // Choose source array (caller can override via prop if needed).
    const source = navigation || dashboardNavigation;

    // If the session is still loading, we return a conservative set:
    // - Only items that don't rely on session flags (no role/visibility dependencies).
    // - We explicitly exclude Upgrade/Billing to avoid any flicker caused by late session hydration.
    if (status === "loading") {
      return source.filter(
        (item) =>
          !item.requiresRole &&
          item.name !== "Upgrade" &&
          item.name !== "Billing"
      );
    }

    // Otherwise, filter based on:
    // 1) Role requirement from config/navigation.ts
    // 2) "Upgrade" hidden when hasPaid = true
    // 3) "Billing" hidden for staff-seat users (role USER + businessId)
    //    and for unpaid individual users (role USER + no businessId + !hasPaid)
    // 4) Read additional visibility hints from config.visibility to keep Navbar
    //    in sync with config declarations (belt & braces).
    return source.filter((item) => {
      // Step 1: Role check from config
      if (item.requiresRole) {
        if (typeof item.requiresRole === "string") {
          if (item.requiresRole !== role) return false;
        } else if (Array.isArray(item.requiresRole)) {
          if (!item.requiresRole.includes(role as any)) return false;
        }
      }

      // Step 2: Hide "Upgrade" if the user already has access
      if (item.name === "Upgrade" && hasPaid) {
        return false;
      }

      // Step 3: Apply Billing-specific runtime rules
      if (item.name === "Billing") {
        const isStaffSeatUser = role === "USER" && !!businessId;
        const isIndividualUser = role === "USER" && !businessId;

        // 3a) Use config.visibility as a declarative guide (sync with config)
        const v = item.visibility || {};

        // Hide for staff-seat users if configured (default true in our config)
        if (v.hideForStaffSeat && isStaffSeatUser) return false;

        // For individual USERs, require payment if configured
        if (v.individualRequiresPaid && isIndividualUser && !hasPaid) return false;

        // 3b) Defensive fallback in case config is missing:
        // (This mirrors your existing explicit logic)
        if (isStaffSeatUser) return false;
        if (isIndividualUser && !hasPaid) return false;
      }

      // Otherwise keep it
      return true;
    });
  }, [navigation, status, role, businessId, hasPaid]);

  return (
    <header>
      <nav className="relative bg-white border-gray-200 shadow-sm">
        {/* Desktop navigation:
            - We render `navItems` computed above.
            - Active route styling is based on next/navigation `usePathname`. */}
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

        {/* Mobile hamburger toggle:
            - Toggles visibility of the collapsible mobile menu below. */}
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

        {/* Mobile menu:
            - Renders the same filtered `navItems`.
            - Closes after selecting an item for a smoother UX. */}
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

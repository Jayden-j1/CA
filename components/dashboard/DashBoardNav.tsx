// components/dashboard/DashboardNavbar.tsx
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
// Why filter here?
// - The Navbar presents links based on the runtime session state (role, hasPaid, businessId).
// - The Billing PAGE/API is also guarded server-side, so typing the URL won’t bypass it.
// - Doing both creates a great UX: users don't see options they cannot access,
//   and even if they type a URL directly, they’re blocked securely.
//
// Improvements in this version:
// - Uses `useSession()` `status` to prevent a brief flicker of "Billing"/"Upgrade"
//   while the session is being hydrated in the browser.
// - Retains role filtering via config/navigation.ts + adds extra runtime conditions.
// - Heavily documented to make the decision logic easy to maintain.

'use client';

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { dashboardNavigation, NavItem } from "@/config/navigation";

// NavbarProps allows optionally passing a custom nav array (defaults to dashboardNavigation)
interface NavbarProps {
  navigation?: NavItem[];
}

const Navbar: React.FC<NavbarProps> = ({ navigation }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const pathname = usePathname();

  // We use `useSession` to read the authenticated user's session:
  // - `status === "loading"`: NextAuth hasn't hydrated the session yet on the client,
  //    avoid rendering links that depend on session flags to prevent flicker.
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
    // - Either a blank array, or an array stripped of items that could flicker.
    // Here we choose to hide all session-dependent links to prevent any mis-flash.
    if (status === "loading") {
      // Return only items that don't require any role and aren't Upgrade/Billing.
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
    return source.filter((item) => {
      // Step 1: Role check
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

      // Step 3: Hide "Billing" for staff-seat users & unpaid individual users
      if (item.name === "Billing") {
        const isStaffSeatUser = role === "USER" && !!businessId;
        if (isStaffSeatUser) return false;

        // Individual user case: show Billing only if they've paid
        const isIndividualUser = role === "USER" && !businessId;
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

export default Navbar;

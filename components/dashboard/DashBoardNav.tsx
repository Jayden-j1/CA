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
// Why this filter here?
// - The Navbar presents links based on the session state (role, hasPaid, businessId).
// - We also guard the Billing PAGE itself (see billing/page.tsx), so typing the URL won’t bypass it.
// - This keeps UX consistent: you don't see options you can't use.

'use client';

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { dashboardNavigation, NavItem } from "@/config/navigation";

// NavbarProps allows optionally passing a custom nav array
interface NavbarProps {
  navigation?: NavItem[];
}

const Navbar: React.FC<NavbarProps> = ({ navigation }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  // Pull relevant values from session for filtering
  const role = session?.user?.role;
  const businessId = session?.user?.businessId || null;
  const hasPaid = !!session?.user?.hasPaid;

  // ------------------------------
  // Final filtered list of nav items
  // ------------------------------
  const navItems = (navigation || dashboardNavigation).filter((item) => {
    // Step 1: Role filter from config (exact match or array contains)
    if (item.requiresRole) {
      if (typeof item.requiresRole === "string") {
        if (item.requiresRole !== role) return false;
      } else if (Array.isArray(item.requiresRole)) {
        if (!item.requiresRole.includes(role as any)) return false;
      }
    }

    // Step 2: Hide "Upgrade" for paid users
    if (item.name === "Upgrade" && hasPaid) {
      return false;
    }

    // Step 3: Hide "Billing" for staff-seat users:
    // - role === "USER"
    // - businessId != null (means they belong to a business; i.e., seat user)
    // - Indiv. purchasers (USER with no businessId) can see Billing IF they havePaid
    if (item.name === "Billing") {
      const isStaffSeatUser = role === "USER" && !!businessId;
      if (isStaffSeatUser) return false;

      // Optional: If you want to hide Billing from unpaid individual users as well:
      const isIndividualUser = role === "USER" && !businessId;
      if (isIndividualUser && !hasPaid) return false;
    }

    return true;
  });

  return (
    <header>
      <nav className="relative bg-white border-gray-200 shadow-sm">
        {/* Desktop nav */}
        <div className="hidden lg:flex space-x-6 items-center">
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

        {/* Mobile toggle */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="lg:hidden px-3 py-2 text-gray-700 border border-gray-300 rounded"
          aria-label="Toggle menu"
        >
          ☰
        </button>

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

export default Navbar;

// app/components/Header/DashboardNavbar.tsx (example path)

'use client';

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { dashboardNavigation, NavItem } from "@/config/navigation"; // ✅ centralized config

interface NavbarProps {
  navigation?: NavItem[];
}

const Navbar: React.FC<NavbarProps> = ({ navigation }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role; // e.g. "USER", "BUSINESS_OWNER", "ADMIN"

  // ✅ Use config and filter by role
  const navItems = (navigation || dashboardNavigation).filter((item) => {
    if (item.requiresRole && item.requiresRole !== role) {
      return false;
    }
    return true;
  });

  return (
    <header>
      <nav className="relative bg-white border-gray-200 shadow-sm">
        {/* ... existing markup unchanged ... */}
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

        {/* Mobile menu also uses navItems */}
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

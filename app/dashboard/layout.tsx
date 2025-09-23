// app/dashboard/layout.tsx
//
// Fix for role-based nav items:
// - Define a NavItem type (so TS knows items have name + href).
// - Cast the array before filtering, so "false" entries are removed cleanly.

"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import ButtonWithSpinner from "@/components/ui/buttonWithSpinner";

// Explicit type for nav items
interface NavItem {
  name: string;
  href: string;
}

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const [loggingOut, setLoggingOut] = useState(false);

  // Role-aware nav items
  const navItems: NavItem[] = [
    { name: "Dashboard Home", href: "/dashboard" },
    { name: "Course Content", href: "/dashboard/courses" },
    { name: "Map", href: "/dashboard/map" },
    ...(role === "BUSINESS_OWNER"
      ? [
          { name: "Manage Staff", href: "/dashboard/staff" },
          { name: "Add Staff", href: "/dashboard/add-staff" },
        ]
      : []),
    ...(role === "ADMIN"
      ? [{ name: "Admin Panel", href: "/dashboard/admin" }]
      : []),
  ];

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md px-4 py-6 flex flex-col justify-between">
        <div>
          <h2 className="text-xl font-bold mb-6 text-blue-700">Dashboard</h2>
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`px-4 py-2 rounded font-medium ${
                  pathname === item.href
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-blue-100"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>

        {/* Logout button at bottom */}
        <div className="mt-6">
          <ButtonWithSpinner
            onClick={async () => {
              setLoggingOut(true);
              await signOut({ callbackUrl: "/" });
            }}
            loading={loggingOut}
            className="w-full bg-red-600 hover:bg-red-500"
          >
            Logout
          </ButtonWithSpinner>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

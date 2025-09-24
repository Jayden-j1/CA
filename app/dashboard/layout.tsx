// app/dashboard/layout.tsx
//
// Purpose:
// - Layout wrapper for all *dashboard* pages (protected area).
// - Uses DashboardNavbar (role-aware).
// - Excludes the public navbar and footer (no stacking).
// - Adds an optional minimal dashboard footer (customizable later).
//
// Notes:
// - This ensures the dashboard feels like a self-contained app.

"use client";

import { ReactNode } from "react";
import { DashboardNavbar } from "@/components/Header/NavBar"; // ✅ dashboard-specific navbar

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* ✅ Dashboard-only navbar */}
      <DashboardNavbar />

      {/* ✅ Main content area */}
      <main className="flex-1 p-6 bg-gray-100">{children}</main>

      {/* ✅ Minimal dashboard footer (optional) */}
      <footer className="bg-white border-t border-gray-200 py-3 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Cultural Awareness App · Dashboard
      </footer>
    </div>
  );
}









// // app/dashboard/layout.tsx
// //
// // Purpose:
// // - Layout wrapper for all *dashboard* pages (protected area).
// // - Displays DashboardNavbar instead of PublicNavbar.
// // - Still keeps role-based navigation and logout button.
// // - Ensures consistent sidebar + main content layout.

// "use client";

// import { ReactNode } from "react";

// //  New: use DashboardNavbar
// import { DashboardNavbar } from "@/components/Header/NavBar";

// interface DashboardLayoutProps {
//   children: ReactNode;
// }

// export default function DashboardLayout({ children }: DashboardLayoutProps) {
//   return (
//     <div className="min-h-screen flex flex-col">
//       {/*  Dashboard-specific navbar (role-aware links) */}
//       <DashboardNavbar />

//       {/*  Main content of each dashboard page */}
//       <main className="flex-1 p-6 bg-gray-100">{children}</main>
//     </div>
//   );
// }









// // // app/dashboard/layout.tsx
// // //
// // // Fix for role-based nav items:
// // // - Define a NavItem type (so TS knows items have name + href).
// // // - Cast the array before filtering, so "false" entries are removed cleanly.

// // "use client";

// // import { ReactNode, useState } from "react";
// // import Link from "next/link";
// // import { usePathname } from "next/navigation";
// // import { useSession, signOut } from "next-auth/react";
// // import ButtonWithSpinner from "@/components/ui/buttonWithSpinner";

// // // Explicit type for nav items
// // interface NavItem {
// //   name: string;
// //   href: string;
// // }

// // interface DashboardLayoutProps {
// //   children: ReactNode;
// // }

// // export default function DashboardLayout({ children }: DashboardLayoutProps) {
// //   const pathname = usePathname();
// //   const { data: session } = useSession();
// //   const role = session?.user?.role;

// //   const [loggingOut, setLoggingOut] = useState(false);

// //   // Role-aware nav items
// //   const navItems: NavItem[] = [
// //     { name: "Dashboard Home", href: "/dashboard" },
// //     { name: "Course Content", href: "/dashboard/courses" },
// //     { name: "Map", href: "/dashboard/map" },
// //     ...(role === "BUSINESS_OWNER"
// //       ? [
// //           { name: "Manage Staff", href: "/dashboard/staff" },
// //           { name: "Add Staff", href: "/dashboard/add-staff" },
// //         ]
// //       : []),
// //     ...(role === "ADMIN"
// //       ? [{ name: "Admin Panel", href: "/dashboard/admin" }]
// //       : []),
// //   ];

// //   return (
// //     <div className="min-h-screen flex bg-gray-100">
// //       {/* Sidebar */}
// //       <aside className="w-64 bg-white shadow-md px-4 py-6 flex flex-col justify-between">
// //         <div>
// //           <h2 className="text-xl font-bold mb-6 text-blue-700">Dashboard</h2>
// //           <nav className="flex flex-col gap-2">
// //             {navItems.map((item) => (
// //               <Link
// //                 key={item.name}
// //                 href={item.href}
// //                 className={`px-4 py-2 rounded font-medium ${
// //                   pathname === item.href
// //                     ? "bg-blue-600 text-white"
// //                     : "text-gray-700 hover:bg-blue-100"
// //                 }`}
// //               >
// //                 {item.name}
// //               </Link>
// //             ))}
// //           </nav>
// //         </div>

// //         {/* Logout button at bottom */}
// //         <div className="mt-6">
// //           <ButtonWithSpinner
// //             onClick={async () => {
// //               setLoggingOut(true);
// //               await signOut({ callbackUrl: "/" });
// //             }}
// //             loading={loggingOut}
// //             className="w-full bg-red-600 hover:bg-red-500"
// //           >
// //             Logout
// //           </ButtonWithSpinner>
// //         </div>
// //       </aside>

// //       {/* Main content */}
// //       <main className="flex-1 p-6">{children}</main>
// //     </div>
// //   );
// // }

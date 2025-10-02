// components/Header/NavBar.tsx
//
// Purpose:
// - Shared Navbar for public + dashboard.
// - DashboardNavbar now delegates visibility to filterDashboardNavigation()
//   so that "Upgrade" hides when paid and "Billing" appears for paid individuals.
// - Logout is intercepted to call NextAuth.signOut with a callbackUrl.
//
// Why delegate to config/navigation.ts?
// - Single source of truth (role/payment rules live in one place).
// - Easy to maintain and test; Navbar stays thin and presentation-focused.
//
// Pillars:
// - Simplicity: no duplicated logic; rely on filterDashboardNavigation.
// - Robustness: consistent behavior everywhere; one place to change rules.
// - Security: page-level guards still enforce access even if someone types a URL.
//

'use client';

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  publicNavigation,
  dashboardNavigation,
  NavItem,
  filterDashboardNavigation, // ✅ use the centralized filter
} from "@/config/navigation";

// ---------------------------------------------------------
// BaseNavbar: Presentational component
// - Receives a *filtered* list of navItems (public or dashboard).
// - Renders desktop + mobile menus, with a logout link interception.
// - Does NOT perform role logic itself; that's done by the caller.
// ---------------------------------------------------------
const BaseNavbar: React.FC<{ navItems: NavItem[] }> = ({ navItems }) => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const leftItems = navItems.filter((item) => item.align !== "right");
  const rightItems = navItems.filter((item) => item.align === "right");

  // Intercept logout link → trigger NextAuth.signOut with callbackUrl
  const handleMaybeLogout = async (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (href !== "/logout") return; // not the logout link
    e.preventDefault();

    const base = window.location.origin;
    const callbackUrl = `${base}/?logout=success`;
    await signOut({ callbackUrl });
  };

  return (
    <header>
      <nav className="relative bg-white border-gray-200 shadow-sm px-4 py-3 flex items-center justify-between">
        {/* Desktop left-aligned items */}
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

        {/* Desktop right-aligned items */}
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

        {/* Mobile hamburger toggle */}
        <div>
          <button
            onClick={() => setIsOpen((open) => !open)}
            className="lg:hidden px-3 py-2 text-gray-700 border border-gray-300 rounded"
            aria-label="Toggle menu"
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

// ---------------------------------------------------------
// Public Navbar
// ---------------------------------------------------------
export const PublicNavbar: React.FC = () => (
  <BaseNavbar navItems={publicNavigation} />
);

// ---------------------------------------------------------
// Dashboard Navbar
// - Delegates visibility to filterDashboardNavigation so:
//   • "Upgrade" hides when hasPaid === true
//   • "Billing" shows only for paid individual users (and for owners/admin)
//   • "Staff" / "Add Staff" respect role requirements
// ---------------------------------------------------------
export const DashboardNavbar: React.FC = () => {
  const { data: session, status } = useSession();

  const role = session?.user?.role;
  const businessId = session?.user?.businessId ?? null;
  const hasPaid = !!session?.user?.hasPaid;
  const isLoading = status === "loading";

  // ✅ Use the centralized filter to compute final visible items
  const filtered = filterDashboardNavigation({
    navigation: dashboardNavigation,
    role,
    businessId,
    hasPaid,
    isLoading,
  });

  return <BaseNavbar navItems={filtered} />;
};

export default BaseNavbar;









// // components/Header/NavBar.tsx
// //
// // Purpose:
// // - Shared Navbar for public + dashboard.
// // - DashboardNavbar filters links by role and hides “Upgrade” if user.hasPaid.
// // - Intercepts Logout → calls NextAuth.signOut with callbackUrl for toast.
// //
// // Notes:
// // - Upgrade hiding logic uses `session.user.hasPaid` which must be set
// //   correctly in `lib/auth.ts` (NextAuth callbacks). If STAFF_SEAT should also
// //   grant access, ensure `hasPaid` includes that in the JWT callback.
// // - Role-based checks are respected via config/navigation.ts.
// // - Keeps UI logic thin (logic belongs in backend/JWT).
// //
// // What changed in this update?
// // - Heavy inline documentation to make behavior clear.
// // - Small safety tweaks (e.g., early returns, consistent handlers).
// //
// // Why keep Navbar thin?
// // - Navbar shouldn't guess who has access. It should trust `session.user.hasPaid`
// //   computed centrally (NextAuth callback) to avoid duplicated business rules.
// //

// 'use client';

// import { useState } from "react";
// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import { useSession, signOut } from "next-auth/react";
// import {
//   publicNavigation,
//   dashboardNavigation,
//   NavItem,
// } from "@/config/navigation";

// // ---------------------------------------------------------
// // BaseNavbar: Presentational component
// // - Receives a *filtered* list of navItems (public or dashboard).
// // - Renders desktop + mobile menus, with a logout link interception.
// // - Does NOT perform role logic itself; that's done by the caller.
// // ---------------------------------------------------------
// const BaseNavbar: React.FC<{ navItems: NavItem[] }> = ({ navItems }) => {
//   // Toggles mobile menu
//   const [isOpen, setIsOpen] = useState(false);
//   // Current route (for "active" state styles)
//   const pathname = usePathname();

//   // Split items into left vs right-aligned for desktop layout
//   const leftItems = navItems.filter((item) => item.align !== "right");
//   const rightItems = navItems.filter((item) => item.align === "right");

//   // Intercept logout clicks so we can trigger NextAuth.signOut() with a friendly callbackUrl.
//   // This allows showing a toast on the landing page (e.g., `/?logout=success`).
//   const handleMaybeLogout = async (
//     e: React.MouseEvent<HTMLAnchorElement>,
//     href: string
//   ) => {
//     // If link is not logout → do nothing (let Link handle navigation).
//     if (href !== "/logout") return;

//     // Prevent normal navigation
//     e.preventDefault();

//     // Build a callback URL back to the homepage with a query to trigger a toast
//     const base = window.location.origin;
//     const callbackUrl = `${base}/?logout=success`;

//     // Call NextAuth's signOut which clears the session and redirects.
//     await signOut({ callbackUrl });
//   };

//   return (
//     <header>
//       <nav className="relative bg-white border-gray-200 shadow-sm px-4 py-3 flex items-center justify-between">
//         {/* Desktop left-aligned items */}
//         <div className="hidden lg:flex space-x-6 items-center">
//           {leftItems.map((item) => (
//             <Link
//               key={item.name}
//               href={item.href}
//               onClick={(e) => handleMaybeLogout(e, item.href)}
//               className={`px-4 py-2 font-bold rounded transition-colors duration-200 ${
//                 pathname === item.href
//                   ? "bg-blue-500 text-white"
//                   : "text-gray-700 hover:text-white hover:bg-blue-500"
//               }`}
//             >
//               {item.name}
//             </Link>
//           ))}
//         </div>

//         {/* Desktop right-aligned items */}
//         <div className="hidden lg:flex space-x-6 items-center ml-auto">
//           {rightItems.map((item) => (
//             <Link
//               key={item.name}
//               href={item.href}
//               onClick={(e) => handleMaybeLogout(e, item.href)}
//               className={`px-4 py-2 font-bold rounded transition-colors duration-200 ${
//                 pathname === item.href
//                   ? "bg-blue-500 text-white"
//                   : "text-gray-700 hover:text-white hover:bg-blue-500"
//               }`}
//             >
//               {item.name}
//             </Link>
//           ))}
//         </div>

//         {/* Mobile hamburger toggle */}
//         <div>
//           <button
//             onClick={() => setIsOpen((open) => !open)}
//             className="lg:hidden px-3 py-2 text-gray-700 border border-gray-300 rounded"
//             aria-label="Toggle menu"
//           >
//             ☰
//           </button>
//         </div>

//         {/* Mobile menu (full width below the nav bar) */}
//         {isOpen && (
//           <div className="absolute top-full left-0 w-full lg:hidden px-4 pb-4 space-y-1 bg-white shadow z-50">
//             {navItems.map((item) => (
//               <div
//                 key={item.name}
//                 onClick={() => setIsOpen(false)} // Close after clicking an item
//               >
//                 <Link
//                   href={item.href}
//                   onClick={(e) => handleMaybeLogout(e, item.href)}
//                   className={`block py-3 px-4 rounded font-bold transition-colors duration-200 ${
//                     pathname === item.href
//                       ? "bg-blue-500 text-white"
//                       : "text-gray-700 hover:text-blue-600 hover:bg-gray-100"
//                   }`}
//                 >
//                   {item.name}
//                 </Link>
//               </div>
//             ))}
//           </div>
//         )}
//       </nav>
//     </header>
//   );
// };

// // ---------------------------------------------------------
// // Public Navbar
// // - Uses navigation defined in config/navigation.ts for public pages.
// // ---------------------------------------------------------
// export const PublicNavbar: React.FC = () => (
//   <BaseNavbar navItems={publicNavigation} />
// );

// // ---------------------------------------------------------
// // Dashboard Navbar
// // - Role-aware filtering + hide "Upgrade" if user.hasPaid is true.
// // - Important: `hasPaid` must be computed in NextAuth JWT callback and
// //   should include staff-seat access if your business rules allow it.
// // ---------------------------------------------------------
// export const DashboardNavbar: React.FC = () => {
//   const { data: session } = useSession();

//   // Extract role + hasPaid from session
//   const role = session?.user?.role;
//   const hasPaid = session?.user?.hasPaid;

//   // Filter dashboard links by role and payment status.
//   const filtered = dashboardNavigation.filter((item) => {
//     // ✅ Hide Upgrade if the user has access (hasPaid === true)
//     //    IMPORTANT: Ensure `hasPaid` is calculated correctly in `lib/auth.ts`.
//     if (item.name === "Upgrade" && hasPaid) return false;

//     // ✅ If a link doesn't specify role requirements, allow it.
//     if (!item.requiresRole) return true;

//     // ✅ If a link requires a single role (string)
//     if (typeof item.requiresRole === "string") {
//       return item.requiresRole === role;
//     }

//     // ✅ If a link allows multiple roles (array)
//     if (Array.isArray(item.requiresRole)) {
//       return item.requiresRole.includes(role as any);
//     }

//     // Default deny if unknown spec
//     return false;
//   });

//   return <BaseNavbar navItems={filtered} />;
// };

// export default BaseNavbar;

// config/navigation.ts
//
// Purpose:
// - Central registry for all navigation entries.
// - Desktop alignment (left/right) + role-gating via `requiresRole`.
// - We keep "Upgrade" defined here so the Navbar can hide it at runtime
//   when session.user.hasPaid === true.

export type Role = "USER" | "BUSINESS_OWNER" | "ADMIN";

export interface NavItem {
  name: string;
  href: string;
  requiresRole?: Role | Role[]; // optional: single or multiple roles
  align?: "left" | "right";     // optional: desktop alignment grouping
}

// ---------------------------
// Public navigation
// ---------------------------
export const publicNavigation: NavItem[] = [
  { name: "Home", href: "/", align: "left" },
  { name: "About", href: "/about", align: "left" },
  { name: "Services", href: "/services", align: "left" },
  { name: "Contact", href: "/contact", align: "left" },
  { name: "Login/Signup", href: "/login", align: "right" },
];

// ---------------------------
// Dashboard navigation
// ---------------------------
// Notes:
// - Role-filtering is done by the DashboardNavbar at runtime.
// - "Upgrade" remains defined here but will be hidden for paid users.
export const dashboardNavigation: NavItem[] = [
  { name: "Home", href: "/dashboard", align: "left" },
  { name: "Map", href: "/dashboard/map", align: "left" },
  { name: "Course", href: "/dashboard/course", align: "left" },

  {
    name: "Staff",
    href: "/dashboard/staff",
    requiresRole: ["BUSINESS_OWNER", "ADMIN"],
    align: "left",
  },
  {
    name: "Add Staff",
    href: "/dashboard/add-staff",
    requiresRole: ["BUSINESS_OWNER", "ADMIN"],
    align: "left",
  },

  // ✅ Will be hidden dynamically if session.user.hasPaid === true
  { name: "Upgrade", href: "/dashboard/upgrade", align: "left" },

  {
    name: "Billing",
    href: "/dashboard/billing",
    requiresRole: ["USER", "BUSINESS_OWNER", "ADMIN"],
    align: "left",
  },

  {
    name: "Admin",
    href: "/dashboard/admin",
    requiresRole: "ADMIN",
    align: "left",
  },

  // Keep logout right-aligned
  { name: "Logout", href: "/logout", align: "right" },
];









// // config/navigation.ts
// //
// // Purpose:
// // - Centralized navigation definitions for public and dashboard navbars.
// // - Supports role-based navigation and alignment (left/right).
// // - Makes it easy to manage links in one place.
// // - Updated so that "Billing" is only visible for USER, BUSINESS_OWNER, and ADMIN.

// export type Role = "USER" | "BUSINESS_OWNER" | "ADMIN";

// export interface NavItem {
//   name: string;
//   href: string;
//   requiresRole?: Role | Role[]; // ✅ can be single role or multiple roles
//   align?: "left" | "right"; // ✅ optional: controls desktop alignment
// }

// // ---------------------------
// // Public-facing navigation
// // ---------------------------
// export const publicNavigation: NavItem[] = [
//   { name: "Home", href: "/", align: "left" },
//   { name: "About", href: "/about", align: "left" },
//   { name: "Services", href: "/services", align: "left" },
//   { name: "Contact", href: "/contact", align: "left" },
//   { name: "Login/Signup", href: "/login", align: "right" },
// ];

// // ---------------------------
// // Dashboard navigation
// // ---------------------------
// // Notes:
// // - Role-based filtering happens at runtime inside your Navbar component.
// // - Billing is restricted to USER, BUSINESS_OWNER, and ADMIN.
// // - Staff management (Staff, Add Staff) is restricted to BUSINESS_OWNER + ADMIN.
// // - Admin panel is only for ADMIN.
// export const dashboardNavigation: NavItem[] = [
//   // Always visible to any authenticated user
//   { name: "Home", href: "/dashboard", align: "left" },
//   { name: "Map", href: "/dashboard/map", align: "left" },
//   { name: "Course", href: "/dashboard/course", align: "left" },

//   // Staff management — only for BUSINESS_OWNER and ADMIN
//   {
//     name: "Staff",
//     href: "/dashboard/staff",
//     requiresRole: ["BUSINESS_OWNER", "ADMIN"],
//     align: "left",
//   },
//   {
//     name: "Add Staff",
//     href: "/dashboard/add-staff",
//     requiresRole: ["BUSINESS_OWNER", "ADMIN"],
//     align: "left",
//   },

//   // Upgrade option — anyone without an active package
//   { name: "Upgrade", href: "/dashboard/upgrade", align: "left" },

//   // ✅ Billing — available for USER, BUSINESS_OWNER, ADMIN
//   {
//     name: "Billing",
//     href: "/dashboard/billing",
//     requiresRole: ["USER", "BUSINESS_OWNER", "ADMIN"],
//     align: "left",
//   },

//   // Admin-only panel
//   {
//     name: "Admin",
//     href: "/dashboard/admin",
//     requiresRole: "ADMIN",
//     align: "left",
//   },

//   // Always keep logout aligned to the right
//   { name: "Logout", href: "/logout", align: "right" },
// ];

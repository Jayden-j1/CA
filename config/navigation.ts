// config/navigation.ts
//
// Purpose:
// - Central registry for all navigation entries.
// - Desktop alignment (left/right) + role-gating via `requiresRole`.
// - "Upgrade" is defined here but hidden at runtime if user.hasPaid === true.
// - "Billing" is defined here for USER, BUSINESS_OWNER, ADMIN —
//   but DashboardNavbar applies an additional runtime filter so STAFF-SEAT users
//   (role USER + businessId != null) won’t see it.
//
// Why keep this simple?
// - We keep the definitions declarative (what is possible).
// - Final per-user visibility is enforced in the Navbar and (importantly) on the page route itself.
//   → This avoids exposing links that a user can't actually access if typed manually.

export type Role = "USER" | "BUSINESS_OWNER" | "ADMIN";

export interface NavItem {
  name: string;
  href: string;
  requiresRole?: Role | Role[];
  align?: "left" | "right";
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
// - Role-filtering is applied at runtime (Navbar).
// - Upgrade is hidden if user.hasPaid === true.
// - Billing is further filtered in DashboardNavbar so that
//   staff users under a business don’t see it.
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

  { name: "Logout", href: "/logout", align: "right" },
];

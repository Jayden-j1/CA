// config/navigation.ts
//
// Purpose:
// - Centralized navigation definitions for public and dashboard navbars.
// - Supports role-based navigation and alignment (left/right).
// - Makes it easy to manage links in one place.

export type Role = "USER" | "BUSINESS_OWNER" | "ADMIN";

export interface NavItem {
  name: string;
  href: string;
  requiresRole?: Role | Role[]; // ✅ can be single role or multiple roles
  align?: "left" | "right"; // ✅ optional: controls desktop alignment
}

// ---------------------------
// Public-facing navigation
// ---------------------------
export const publicNavigation: NavItem[] = [
  { name: "Home", href: "/", align: "left" },
  { name: "About", href: "/about", align: "left" },
  { name: "Services", href: "/services", align: "left" },
  { name: "Map", href: "/map", align: "left" },
  { name: "Contact", href: "/contact", align: "left" },
  { name: "Login/Signup", href: "/login", align: "right" },
];

// ---------------------------
// Dashboard navigation
// ---------------------------
// Notes:
// - All dashboard links live here for consistency.
// - Role-based filtering happens at runtime in the Navbar component.
// - "Billing" has no requiresRole → shown to all authenticated users.
export const dashboardNavigation: NavItem[] = [
  { name: "Home", href: "/dashboard", align: "left" },
  { name: "Map", href: "/dashboard/map", align: "left" },
  { name: "Course", href: "/dashboard/course", align: "left" },

  {
    name: "Staff",
    href: "/dashboard/staff",
    requiresRole: ["BUSINESS_OWNER", "ADMIN"], // only business owners & admins
    align: "left",
  },
  {
    name: "Add Staff",
    href: "/dashboard/add-staff",
    requiresRole: ["BUSINESS_OWNER", "ADMIN"],
    align: "left",
  },

  { name: "Upgrade", href: "/dashboard/upgrade", align: "left" },

  // ✅ NEW: Billing page — available to all logged-in users
  { name: "Billing", href: "/dashboard/billing", align: "left" },

  {
    name: "Admin",
    href: "/dashboard/admin",
    requiresRole: "ADMIN", // only admins
    align: "left",
  },

  // Always keep logout aligned to the right
  { name: "Logout", href: "/logout", align: "right" },
];

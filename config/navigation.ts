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
  { name: "Login/Signup", href: "/login", align: "right" }, // ✅ floats right
];

// ---------------------------
// Dashboard navigation
// ---------------------------
export const dashboardNavigation: NavItem[] = [
  { name: "Home", href: "/dashboard", align: "left" },
  { name: "Add Staff", href: "/dashboard/add-staff", requiresRole: "BUSINESS_OWNER", align: "left" },
  { name: "Course Content", href: "/dashboard/content", align: "left" },
  { name: "Map", href: "/dashboard/map", align: "left" },
  { name: "Logout", href: "/logout", align: "right" }, // ✅ floats right
];

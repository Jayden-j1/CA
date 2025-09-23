// config/navigation.ts
//
// Purpose:
// - Centralized navigation definitions for public and dashboard navbars.
// - Makes it easy to manage links in one place.
// - Supports role-based navigation for dashboard items.

export type NavItem = {
  name: string;
  href: string;
  requiresRole?: "BUSINESS_OWNER" | "ADMIN"; 
  // optional: if set, item is only shown to users with that role
};

// Public-facing navigation (always visible to everyone)
export const publicNavigation: NavItem[] = [
  { name: "Home", href: "/" },
  { name: "About", href: "/about" },
  { name: "Services", href: "/services" },
  { name: "Map", href: "/map" },
  { name: "Contact", href: "/contact" },
  { name: "Login/Signup", href: "/login" },
];

// Dashboard navigation (requires login; some items role-gated)
export const dashboardNavigation: NavItem[] = [
  { name: "Home", href: "/dashboard" }, // always visible
  { name: "Add Staff", href: "/dashboard/add-staff", requiresRole: "BUSINESS_OWNER" }, // Business Owners only
  { name: "Course Content", href: "/dashboard/content" },
  { name: "Map", href: "/dashboard/map" },
  { name: "Logout", href: "/logout" }, // all roles
];

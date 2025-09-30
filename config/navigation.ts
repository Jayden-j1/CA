// config/navigation.ts
//
// Purpose:
// - Central registry for all navigation entries.
// - Desktop alignment (left/right) + role-gating via `requiresRole`.
// - "Upgrade" is defined here but hidden at runtime if user.hasPaid === true.
// - "Billing" is defined for USER, BUSINESS_OWNER, ADMIN —
//   and (NEW) carries explicit visibility meta so it's crystal clear that
//   staff-seat users (role USER with businessId) shouldn't see it,
//   and individual USERs must have paid.
//
// Why add metadata here?
// - Your DashboardNavbar already enforces the rules at runtime.
//   However, adding metadata here makes intent explicit and protects future refactors.
// - We keep the definitions declarative (what is possible).
// - Final per-user visibility is enforced in the Navbar and (importantly) on the page route itself.
//   → This avoids exposing links that a user can't actually access if typed manually.

export type Role = "USER" | "BUSINESS_OWNER" | "ADMIN";

/**
 * Extra visibility hints to document/drive runtime filtering.
 * - hideForStaffSeat: Hide this nav item for staff-seat users (role USER + businessId != null).
 * - individualRequiresPaid: If the user is an individual USER (no businessId),
 *   only show if they have hasPaid === true.
 *
 * NOTE: Your current DashboardNavbar enforces these rules in code already.
 * These flags serve as documentation + future-proof hooks should you want
 * the navbar to read them instead of hardcoding logic.
 */
export interface NavVisibility {
  hideForStaffSeat?: boolean;
  individualRequiresPaid?: boolean;
}

export interface NavItem {
  name: string;
  href: string;
  requiresRole?: Role | Role[]; // Roles permitted to see this item in principle
  align?: "left" | "right";     // Desktop alignment
  // NEW: optional visibility metadata (advisory; runtime should enforce)
  visibility?: NavVisibility;
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
// - Upgrade is hidden if user.hasPaid === true (runtime).
// - Billing is *further* filtered at runtime so that
//   staff users under a business don’t see it, and
//   individual users must have hasPaid === true to see it.
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

  // ✅ Upgrade remains defined but is hidden at runtime if user.hasPaid === true
  { name: "Upgrade", href: "/dashboard/upgrade", align: "left" },

  {
    name: "Billing",
    href: "/dashboard/billing",
    // Keep USER allowed in principle because *individual* users should see it.
    // Staff-seat users are a subset of USER and must be hidden at runtime.
    requiresRole: ["USER", "BUSINESS_OWNER", "ADMIN"],
    align: "left",
    // NEW: Make intent explicit via visibility hints
    visibility: {
      // Hide for staff-seat users (role USER + businessId not null)
      hideForStaffSeat: true,
      // Only show to individual users (USER with no businessId) if they have hasPaid === true
      individualRequiresPaid: true,
    },
  },

  {
    name: "Admin",
    href: "/dashboard/admin",
    requiresRole: "ADMIN",
    align: "left",
  },

  { name: "Logout", href: "/logout", align: "right" },
];

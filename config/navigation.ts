// config/navigation.ts
//
// Purpose:
// - Central registry for all navigation entries (public + dashboard).
// - Declarative "who can see what" via:
//    • requiresRole  → role-based gating
//    • visibility    → feature flags like hideWhenPaid, hideForStaffSeat, etc.
// - Export a single helper `filterDashboardNavigation(...)` that computes the
//   final list of visible links for a given user/session.
//
// Why this pattern?
// - Single source of truth: instead of scattering business rules across Navbar components,
//   pages, and APIs, we describe the intent here and consume it wherever needed.
// - Zero-code changes: want to hide "Billing" for staff? Flip a flag here.
// - Easy testing: one function can be unit-tested with many scenarios.
//
// Types:
// - Role:                     application roles
// - NavVisibility:            extra flags to describe visibility conditions
// - NavItem:                  one entry in the nav with optional role/visibility
// - Public + Dashboard navs:  declarative arrays
// - filterDashboardNavigation: merges all rules to produce final list

export type Role = "USER" | "BUSINESS_OWNER" | "ADMIN";

/**
 * Extra visibility hints that drive runtime filtering.
 * - hideWhenPaid:            Hide if the user hasPaid === true (e.g., Upgrade).
 * - hideForStaffSeat:        Hide for staff-seat users (role USER + businessId != null).
 * - individualRequiresPaid:  If user is an individual (USER + no businessId), only show when hasPaid === true.
 * - hideWhileLoading:        Hide during session hydration (prevents flicker); default true.
 */
export interface NavVisibility {
  hideWhenPaid?: boolean;
  hideForStaffSeat?: boolean;
  individualRequiresPaid?: boolean;
  hideWhileLoading?: boolean;
}

/**
 * One navigation entry.
 * - align: "left" | "right" controls desktop grouping. For example:
 *    • LEFT  → "Home", "Map", "Course", etc.
 *    • RIGHT → "Logout"
 */
export interface NavItem {
  name: string;
  href: string;
  requiresRole?: Role | Role[];
  align?: "left" | "right";
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
// - Role-filtering + visibility rules are resolved by filterDashboardNavigation.
// - "Upgrade" disappears automatically once hasPaid === true.
// - "Billing" disappears for staff-seat users, and for unpaid individual users.
// - "Logout" is aligned to the RIGHT so our navbar renders it on the right side on desktop.
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

  // ✅ Only visible when user.hasPaid === false
  {
    name: "Upgrade",
    href: "/dashboard/upgrade",
    align: "left",
    visibility: {
      hideWhenPaid: true, // hide once paid
      hideWhileLoading: true, // also hide during hydration to prevent flicker
    },
  },

  // ✅ Billing visibility rules:
  // - hideForStaffSeat ⇒ hide when role=USER AND businessId != null (staff-seat users)
  // - individualRequiresPaid ⇒ show only when individual USER has hasPaid = true
  {
    name: "Billing",
    href: "/dashboard/billing",
    requiresRole: ["USER", "BUSINESS_OWNER", "ADMIN"],
    align: "left",
    visibility: {
      hideForStaffSeat: true,
      individualRequiresPaid: true,
      hideWhileLoading: true, // hide while loading to avoid flashes
    },
  },

  {
    name: "Admin",
    href: "/dashboard/admin",
    requiresRole: "ADMIN",
    align: "left",
  },

  // 👉 RIGHT-aligned so our navbar renders it on the far right on desktop
  { name: "Logout", href: "/logout", align: "right" },
];

// -------------------------------------------------------------------
// Filter helper — central place to convert rules to a visible list
// -------------------------------------------------------------------

/**
 * Input shape for filterDashboardNavigation.
 */
export interface NavFilterContext {
  navigation?: NavItem[]; // optional override
  role?: Role; // authenticated user's role
  businessId?: string | null; // user's businessId (null for individuals)
  hasPaid?: boolean; // whether the user has access
  isLoading?: boolean; // whether session is hydrating on client
}

/**
 * filterDashboardNavigation:
 * Applies role checks + visibility flags to produce the final list of visible items.
 *
 * Rules:
 * 1) While isLoading === true → hide any item with visibility.hideWhileLoading !== false
 *    (default is true for safety). We also default to hiding items that rely on role/payment.
 * 2) Role checks: if requiresRole is string/array, ensure the user's role is included.
 * 3) Visibility flags:
 *    - hideWhenPaid: hide when hasPaid === true
 *    - hideForStaffSeat: hide when role === "USER" && businessId != null
 *    - individualRequiresPaid: if role === "USER" && !businessId && !hasPaid → hide
 */
export function filterDashboardNavigation(ctx: NavFilterContext): NavItem[] {
  const {
    navigation,
    role,
    businessId,
    hasPaid,
    isLoading,
  } = ctx;

  const source = navigation || dashboardNavigation;

  return source.filter((item) => {
    const v: NavVisibility = item.visibility || {};

    // 1) Loading-state handling:
    if (isLoading) {
      const shouldHideWhileLoading = v.hideWhileLoading ?? true; // default true
      if (shouldHideWhileLoading) return false;

      // If the item requires a role but session is still loading → hide
      if (item.requiresRole) return false;
    }

    // 2) Role checks:
    if (item.requiresRole) {
      if (!role) return false; // if we don't know role yet, hide it

      if (typeof item.requiresRole === "string") {
        if (item.requiresRole !== role) return false;
      } else if (Array.isArray(item.requiresRole)) {
        if (!item.requiresRole.includes(role)) return false;
      }
    }

    // 3) Visibility flags:
    //   - hideWhenPaid
    if (v.hideWhenPaid && hasPaid) {
      return false;
    }

    //   - hideForStaffSeat ⇒ role=USER + businessId present
    const isStaffSeatUser = role === "USER" && !!businessId;
    if (v.hideForStaffSeat && isStaffSeatUser) {
      return false;
    }

    //   - individualRequiresPaid ⇒ role=USER + no businessId + !hasPaid
    const isIndividualUser = role === "USER" && !businessId;
    if (v.individualRequiresPaid && isIndividualUser && !hasPaid) {
      return false;
    }

    return true;
  });
}

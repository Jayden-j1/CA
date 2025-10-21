// /middleware.ts
//
// ============================================================
// ✅ Purpose
// - Protects /dashboard routes for authenticated users.
// - Restricts /cms (Sanity Studio) to ADMIN and BUSINESS_OWNER roles.
// - Enforces mustChangePassword redirect for security.
//
// 🧱 Pillars
// - Efficiency  : Minimal checks, short-circuited conditions.
// - Robustness  : Explicit fallbacks for unauthenticated users.
// - Simplicity  : Centralized role logic.
// - Ease of mgmt: Single source of truth for protected routes.
// - Security    : Prevents unauthorized access to CMS and dashboard.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// 🚧 Protected routes (dashboard)
const protectedRoutes = ["/dashboard"];

// 🔐 Role-based restrictions for subpaths
const roleRestrictedRoutes: Record<string, string[]> = {
  "/dashboard/staff": ["BUSINESS_OWNER", "ADMIN"],
  "/cms": ["ADMIN", "BUSINESS_OWNER"], // New: restrict CMS access
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1️⃣ Enforce authentication for dashboard routes
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    const token = await getToken({ req });
    if (!token) return NextResponse.redirect(new URL("/login", req.url));

    // 2️⃣ Role-based restrictions
    const userRole = (token.role as string) ?? "";
    for (const [route, allowedRoles] of Object.entries(roleRestrictedRoutes)) {
      if (pathname.startsWith(route) && !allowedRoles.includes(userRole)) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // 3️⃣ Enforce password reset requirement
    if (token.mustChangePassword === true && !pathname.startsWith("/change-password")) {
      return NextResponse.redirect(new URL("/change-password", req.url));
    }
  }

  // 4️⃣ CMS protection even if user isn’t in dashboard routes
  if (pathname.startsWith("/cms")) {
    const token = await getToken({ req });
    if (!token) return NextResponse.redirect(new URL("/login", req.url));

    const userRole = (token.role as string) ?? "";
    if (!["ADMIN", "BUSINESS_OWNER"].includes(userRole)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/cms/:path*", "/change-password"],
};

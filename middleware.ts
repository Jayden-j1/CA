// /middleware.ts
//
// Purpose:
// - Global protection for dashboard routes.
// - Redirects unauthenticated users → /login.
// - Redirects unauthorized users (role mismatch) → /dashboard.
// - Prevents "flicker" by blocking before render.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// All dashboard routes require authentication
const protectedRoutes = ["/dashboard"];

// Specific role-based restrictions
const roleRestrictedRoutes: Record<string, string[]> = {
  "/dashboard/staff": ["BUSINESS_OWNER", "ADMIN"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Is this a protected route?
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    const token = await getToken({ req });

    if (!token) {
      // 🚫 No session → redirect to login
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // 2. Role-based checks
    const userRole = (token.role as string) ?? ""; // normalize
    for (const [route, allowedRoles] of Object.entries(roleRestrictedRoutes)) {
      if (pathname.startsWith(route) && !allowedRoles.includes(userRole)) {
        // 🚫 Wrong role → redirect to dashboard
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }
  }

  // ✅ Pass through
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};

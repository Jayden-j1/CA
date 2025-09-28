// /middleware.ts
//
// Purpose:
// - Protect dashboard routes (requires login).
// - Enforce role-based restrictions for certain sub-routes.
// - Prevent flicker by blocking access before page render.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// 🚧 Any URL starting with /dashboard requires authentication
const protectedRoutes = ["/dashboard"];

// 🔐 Role-based route restrictions
// Example: Only BUSINESS_OWNER + ADMIN can access /dashboard/staff
const roleRestrictedRoutes: Record<string, string[]> = {
  "/dashboard/staff": ["BUSINESS_OWNER", "ADMIN"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Block protected routes if no valid session
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    const token = await getToken({ req }); // JWT token extracted

    if (!token) {
      // 🚫 Not logged in → force login
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // 2. Enforce role restrictions
    const userRole = (token.role as string) ?? ""; // normalize empty
    for (const [route, allowedRoles] of Object.entries(roleRestrictedRoutes)) {
      if (pathname.startsWith(route) && !allowedRoles.includes(userRole)) {
        // 🚫 Logged in but wrong role → redirect back to dashboard
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }
  }

  // ✅ Allow access if checks passed
  return NextResponse.next();
}

// Apply to all dashboard sub-routes
export const config = {
  matcher: ["/dashboard/:path*"],
};

// /middleware.ts
//
// Purpose:
// - Protect dashboard routes (requires login).
// - Enforce role-based restrictions for certain sub-routes.
// - NEW: Redirect users flagged with `mustChangePassword = true` to /change-password
//   until they reset their password.
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

  // 1. Check if path is protected
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    const token = await getToken({ req }); // JWT token extracted

    if (!token) {
      // 🚫 Not logged in → force login
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // 2. Enforce role restrictions
    const userRole = (token.role as string) ?? "";
    for (const [route, allowedRoles] of Object.entries(roleRestrictedRoutes)) {
      if (pathname.startsWith(route) && !allowedRoles.includes(userRole)) {
        // 🚫 Logged in but wrong role → redirect back to dashboard home
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // 3. Enforce mustChangePassword flag
    // - Only enforce if true
    // - Allow access to /change-password page itself to prevent redirect loop
    if (token.mustChangePassword === true && !pathname.startsWith("/change-password")) {
      return NextResponse.redirect(new URL("/change-password", req.url));
    }
  }

  // ✅ Allow access if all checks passed
  return NextResponse.next();
}

// Apply to all dashboard sub-routes (and optionally the change-password route if you want)
export const config = {
  matcher: ["/dashboard/:path*", "/change-password"], 
};

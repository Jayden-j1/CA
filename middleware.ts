// /middleware.ts
//
// Purpose
// -------
// - Protect /dashboard routes for authenticated users
// - Restrict /cms to ADMIN and BUSINESS_OWNER
// - Enforce mustChangePassword redirect
//
// NOTE
// ----
// We do NOT block /dashboard/billing after purchase; access is based on auth,
// and UI visibility of "Upgrade" vs "Billing" is handled via nav + session().

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const protectedRoutes = ["/dashboard"];

const roleRestrictedRoutes: Record<string, string[]> = {
  "/dashboard/staff": ["BUSINESS_OWNER", "ADMIN"],
  "/cms": ["ADMIN", "BUSINESS_OWNER"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Auth for dashboard
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    const token = await getToken({ req });
    if (!token) return NextResponse.redirect(new URL("/login", req.url));

    // 2) Role restrictions
    const userRole = (token.role as string) ?? "";
    for (const [route, allowedRoles] of Object.entries(roleRestrictedRoutes)) {
      if (pathname.startsWith(route) && !allowedRoles.includes(userRole)) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // 3) Must change password flow
    if (token.mustChangePassword === true && !pathname.startsWith("/change-password")) {
      return NextResponse.redirect(new URL("/change-password", req.url));
    }
  }

  // 4) CMS protection even outside dashboard matcher
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

// types/next-auth.d.ts
//
// Purpose:
// - Augment NextAuth types to include custom fields: role, businessId, hasPaid, isActive,
//   and (NEW) mustChangePassword.
// - Fixes TS errors like "Property 'mustChangePassword' does not exist on type 'User'"
//   during build.
// - Ensures session.user, JWT, and User all share consistent typings.
//
// Setup:
// - Place this file in `types/` directory.
// - Ensure tsconfig.json has:
//   "typeRoots": ["./types", "./node_modules/@types"]
//
// Usage:
// - Anywhere in your app, you can now safely access:
//   session.user.role, session.user.businessId, session.user.hasPaid, session.user.isActive,
//   session.user.mustChangePassword.

import NextAuth, { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  // -----------------------------
  // Extend User model
  // -----------------------------
  interface User extends DefaultUser {
    id: string;
    role: "USER" | "BUSINESS_OWNER" | "ADMIN"; // ✅ role-based navigation & permissions
    businessId?: string | null;                // ✅ business membership
    hasPaid?: boolean;                         // ✅ dynamic payment flag
    isActive: boolean;                         // ✅ supports soft-delete
    mustChangePassword?: boolean;              // ✅ NEW: force first-login password change
  }

  // -----------------------------
  // Extend Session model
  // -----------------------------
  interface Session {
    user: {
      id: string;
      role: "USER" | "BUSINESS_OWNER" | "ADMIN";
      businessId?: string | null;
      hasPaid: boolean;
      isActive: boolean;           // ✅ ensure available in session.user
      mustChangePassword: boolean; // ✅ NEW: middleware can enforce redirect
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  // -----------------------------
  // Extend JWT model
  // -----------------------------
  interface JWT {
    id: string;
    role: "USER" | "BUSINESS_OWNER" | "ADMIN";
    businessId?: string | null;
    hasPaid: boolean;
    isActive: boolean;            // ✅ stored in JWT for consistency
    mustChangePassword: boolean;  // ✅ NEW: used by middleware + session callback
  }
}

// types/next-auth.d.ts
//
// Purpose:
// - Augment NextAuth types to include custom fields: role, businessId, hasPaid, isActive.
// - Fixes TS errors like "Property 'isActive' does not exist on type 'User'".
// - Ensures session.user, JWT, and User all share consistent typings.
//
// Setup:
// - Place this file in `types/` directory.
// - Ensure tsconfig.json has:
//   "typeRoots": ["./types", "./node_modules/@types"]
//
// Usage:
// - Anywhere in your app, you can now safely access:
//   session.user.role, session.user.businessId, session.user.hasPaid, session.user.isActive.

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
    isActive: boolean;                         // ✅ NEW: supports soft-delete
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
      isActive: boolean; // ✅ ensure available in session.user
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
    isActive: boolean; // ✅ stored in JWT for consistency
  }
}

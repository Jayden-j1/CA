// types/next-auth.d.ts
//
// Purpose:
// - Augment NextAuth types to include our custom fields (role, businessId, hasPaid).
// - Fixes TS errors such as "Property 'role' does not exist on type 'User'".
//
// Setup:
// - Place this file in `types/` directory.
// - Ensure tsconfig.json has:
//   "typeRoots": ["./types", "./node_modules/@types"]

import NextAuth, { DefaultSession } from "next-auth";

// -------------------------
// Extend NextAuth definitions
// -------------------------
declare module "next-auth" {
  interface User {
    id: string;
    role: "USER" | "BUSINESS_OWNER" | "ADMIN";
    businessId?: string | null;
    hasPaid?: boolean;
  }

  interface Session {
    user: User & DefaultSession["user"];
  }

  interface JWT {
    id: string;
    role: "USER" | "BUSINESS_OWNER" | "ADMIN";
    businessId?: string | null;
    hasPaid?: boolean;
  }
}

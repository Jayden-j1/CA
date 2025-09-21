// types/next-auth.d.ts
import NextAuth, { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  // Extending the built-in Session type
  interface Session {
    user: {
      id: string; // from Prisma User.id
      businessId?: string | null; // from User.businessId
      role?: string | null; // from User.role
    } & DefaultSession["user"];
  }

  // Extending the built-in User type (Prisma user fields)
  interface User extends DefaultUser {
    businessId?: string | null;
    role?: string | null;
  }
}

declare module "next-auth/jwt" {
  // Extending JWT so custom fields survive refresh
  interface JWT {
    id: string;
    businessId?: string | null;
    role?: string | null;
  }
}

// lib/auth.ts
//
// Purpose:
// - Configure NextAuth with Prisma + CredentialsProvider.
// - Attach role, businessId, hasPaid, isActive, and mustChangePassword flags to the session.
// - Enforce soft deletion: inactive users cannot log in or access resources.
// - Dynamically check payment status (PACKAGE or STAFF_SEAT) so UI + API trust one flag.
// - NEW: Enforce mustChangePassword → staff with default password must be redirected.

import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          throw new Error("Invalid credentials");
        }

        // Find user
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        const active = user?.isActive ?? true;
        if (!user || !user.hashedPassword || active === false) {
          throw new Error("Invalid credentials or inactive account");
        }

        // Verify password
        const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!valid) throw new Error("Invalid credentials");

        // Return minimal safe object
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as "USER" | "BUSINESS_OWNER" | "ADMIN",
          businessId: user.businessId ?? null,
          isActive: active,
          mustChangePassword: user.mustChangePassword ?? false, // ✅ include flag
          hasPaid: false, // computed later in jwt()
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      // On login, persist new properties
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId ?? null;
        token.isActive = user.isActive;
        token.mustChangePassword = user.mustChangePassword ?? false; // ✅ persist
      }

      // If inactive, bail early
      if (token.isActive === false) {
        token.hasPaid = false;
        return token;
      }

      // Check payments
      let hasPaid = false;
      try {
        const userId = token.id as string;
        const packagePayment = await prisma.payment.findFirst({
          where: { userId, purpose: "PACKAGE" },
          select: { id: true },
        });
        if (packagePayment) {
          hasPaid = true;
        } else {
          const staffSeatPayment = await prisma.payment.findFirst({
            where: { userId, purpose: "STAFF_SEAT" },
            select: { id: true },
          });
          if (staffSeatPayment) hasPaid = true;
        }
      } catch (err) {
        console.error("[auth.jwt] hasPaid check failed:", err);
        hasPaid = false;
      }

      token.hasPaid = hasPaid;
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "USER" | "BUSINESS_OWNER" | "ADMIN";
        session.user.businessId = (token.businessId as string) ?? null;
        session.user.hasPaid = Boolean(token.hasPaid);
        session.user.isActive = (token.isActive as boolean) ?? true;
        session.user.mustChangePassword = (token.mustChangePassword as boolean) ?? false; // ✅ attach
      }
      return session;
    },
  },

  pages: { signIn: "/login" },
};

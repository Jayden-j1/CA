// lib/auth.ts
//
// Purpose:
// - Configure NextAuth with Prisma + CredentialsProvider.
// - Attach role, businessId, hasPaid, and isActive flags to the session.
// - Enforce soft deletion: inactive users cannot log in or access resources.
// - Dynamically check payment status (PACKAGE or STAFF_SEAT) so UI + API trust one flag.
//
// Improvements in this version:
// - Clearer comments + safe defaults for `isActive` (treat undefined as true).
// - `hasPaid` covers PACKAGE purchases AND staff-seat payments.
// - Centralized logic so Navbar, pages, and API trust session.user.hasPaid.

import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  // 🔗 Connects NextAuth to Prisma DB
  adapter: PrismaAdapter(prisma),

  // 🛂 Credentials auth (email + password)
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // 1) Validate input
        if (!credentials?.email || !credentials.password) {
          throw new Error("Invalid credentials");
        }

        // 2) Lookup user in DB by email
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        // 3) Reject if:
        //    - user not found, OR
        //    - missing password hash, OR
        //    - user explicitly marked inactive (soft-deleted)
        //
        // NOTE: If isActive is undefined on older rows, treat as true to avoid
        // false-negatives during migrations. You can backfill later.
        const active = user?.isActive ?? true;
        if (!user || !user.hashedPassword || active === false) {
          throw new Error("Invalid credentials or inactive account");
        }

        // 4) Verify password
        const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!valid) throw new Error("Invalid credentials");

        // 5) Return safe user object (goes into jwt() on login)
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as "USER" | "BUSINESS_OWNER" | "ADMIN",
          businessId: user.businessId ?? null,
          isActive: active,
          hasPaid: false, // will be computed in jwt() callback
        };
      },
    }),
  ],

  // ⚙️ Sessions are JWT-based (stateless & serverless friendly)
  session: { strategy: "jwt" },

  callbacks: {
    // 🔑 JWT callback: runs on login + every request using token
    async jwt({ token, user }) {
      // Copy user data on first login
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId ?? null;
        token.isActive = user.isActive;
      }

      // 🚩 Inactive users never get access.
      if (token.isActive === false) {
        token.hasPaid = false;
        return token;
      }

      // Recompute hasPaid on every request:
      // - true if user has a PACKAGE payment
      // - OR true if user has a STAFF_SEAT payment (staff-seat account)
      let hasPaid = false;

      try {
        const userId = token.id as string;

        // a) PACKAGE purchase?
        const packagePayment = await prisma.payment.findFirst({
          where: { userId, purpose: "PACKAGE" },
          select: { id: true },
        });
        if (packagePayment) {
          hasPaid = true;
        } else {
          // b) STAFF_SEAT purchase for this staff user?
          const staffSeatPayment = await prisma.payment.findFirst({
            where: { userId, purpose: "STAFF_SEAT" },
            select: { id: true },
          });
          if (staffSeatPayment) {
            hasPaid = true;
          }
        }
      } catch (err) {
        // Fail-safe: if DB hiccups, deny access rather than grant it.
        console.error("[auth.jwt] hasPaid check failed:", err);
        hasPaid = false;
      }

      token.hasPaid = hasPaid;
      return token;
    },

    // 🎟️ Session callback: attaches values to session.user for client/server
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "USER" | "BUSINESS_OWNER" | "ADMIN";
        session.user.businessId = (token.businessId as string) ?? null;
        session.user.hasPaid = Boolean(token.hasPaid);
        session.user.isActive = (token.isActive as boolean) ?? true;
      }
      return session;
    },
  },

  // Custom login page
  pages: { signIn: "/login" },
};

// lib/auth.ts
//
// Purpose:
// - Configure NextAuth with Prisma + CredentialsProvider.
// - Attach role, businessId, hasPaid flags to the session.
// - Dynamically check payment status (PACKAGE or STAFF_SEAT) so UI + API trust one flag.
//
// Improvements in this version:
// - `hasPaid` covers PACKAGE purchases AND staff-seat payments.
// - Centralized logic so Navbar, pages, and middleware can all trust session.user.hasPaid.

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

        // 2) Lookup user in DB
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user || !user.hashedPassword) throw new Error("Invalid credentials");

        // 3) Verify password
        const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!valid) throw new Error("Invalid credentials");

        // 4) Return safe user object (goes into jwt() on login)
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as "USER" | "BUSINESS_OWNER" | "ADMIN",
          businessId: user.businessId ?? null,
          hasPaid: false, // updated in jwt callback
        };
      },
    }),
  ],

  // ⚙️ Sessions are JWT-based
  session: { strategy: "jwt" },

  callbacks: {
    // 🔑 JWT callback: runs on login + every request using token
    async jwt({ token, user }) {
      // Copy user data on login
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId ?? null;
      }

      // Recompute hasPaid every request
      let hasPaid = false;

      try {
        // a) PACKAGE purchase?
        const packagePayment = await prisma.payment.findFirst({
          where: { userId: token.id as string, purpose: "PACKAGE" },
          select: { id: true },
        });
        if (packagePayment) {
          hasPaid = true;
        } else {
          // b) STAFF_SEAT purchase for this staff user?
          const staffSeatPayment = await prisma.payment.findFirst({
            where: { userId: token.id as string, purpose: "STAFF_SEAT" },
            select: { id: true },
          });
          if (staffSeatPayment) {
            hasPaid = true;
          }
        }
      } catch (err) {
        console.error("[auth.jwt] hasPaid check failed:", err);
        hasPaid = false; // fail safe: no access
      }

      token.hasPaid = hasPaid;
      return token;
    },

    // 🎟️ Session callback: attaches values to session.user
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "USER" | "BUSINESS_OWNER" | "ADMIN";
        session.user.businessId = (token.businessId as string) ?? null;
        session.user.hasPaid = Boolean(token.hasPaid);
      }
      return session;
    },
  },

  // Custom login page
  pages: { signIn: "/login" },
};

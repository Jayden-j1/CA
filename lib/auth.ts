// lib/auth.ts
//
// Purpose:
// - Configure NextAuth with Prisma + CredentialsProvider.
// - Attach role, businessId, hasPaid flags to the session.
// - Dynamically check payment status on every request to keep access up to date.
//
// NEW in this version:
// - `hasPaid` is now true if the user has a PACKAGE payment
//   OR if the user has a STAFF_SEAT payment saved under their own userId.
//   This covers the case where a business owner/admin pays to add that specific staff.
//
// Why we do it in the JWT callback:
// - The JWT callback runs on every request where the token is used, so it's the
//   single source of truth for "does this user have access?" (hasPaid).
// - This avoids duplicating payment logic across pages/components.
// - Navbar, protected pages, and middleware can trust the same flag.

import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  // 🔗 Connects NextAuth to Prisma database
  adapter: PrismaAdapter(prisma),

  // 🛂 Authentication method: Credentials (email + password)
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // 1) Reject if missing input
        if (!credentials?.email || !credentials.password) {
          throw new Error("Invalid credentials");
        }

        // 2) Find user by email
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user || !user.hashedPassword) throw new Error("Invalid credentials");

        // 3) Validate password with bcrypt
        const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!valid) throw new Error("Invalid credentials");

        // 4) Return safe user data (this becomes `user` in jwt callback)
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as "USER" | "BUSINESS_OWNER" | "ADMIN",
          businessId: user.businessId ?? null,
          hasPaid: false, // 🚩 Will be updated in jwt() based on DB
        };
      },
    }),
  ],

  // ⚙️ Use JWT-based sessions (lighter, works across serverless)
  session: { strategy: "jwt" },

  callbacks: {
    // 🔑 Runs whenever a JWT is issued/updated
    async jwt({ token, user }) {
      // 1) On first login, copy values from the db user → token
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId ?? null;
      }

      // 2) Compute hasPaid on every request from DB
      //    Access is granted if ANY of these is true:
      //    - The user has any PACKAGE payment (individual or business)
      //    - The user has any STAFF_SEAT payment saved under their own userId
      //
      // NOTE:
      // - We rely on your current webhook to save STAFF_SEAT payments with
      //   userId = staff.id (the staff account’s ID).
      // - If one day you want business-wide seats (one payer unlocks all staff),
      //   you'd need to store businessId on Payment and then query:
      //     where: { businessId: token.businessId, purpose: "STAFF_SEAT" }
      //   and ensure you handle role checks accordingly.
      let hasPaid = false;

      try {
        // a) Check for any PACKAGE payment for this user
        const packagePayment = await prisma.payment.findFirst({
          where: { userId: token.id as string, purpose: "PACKAGE" },
          select: { id: true }, // keep it light
        });

        if (packagePayment) {
          hasPaid = true;
        } else {
          // b) Otherwise, check for any STAFF_SEAT payment for this user (staff member)
          const staffSeatPayment = await prisma.payment.findFirst({
            where: { userId: token.id as string, purpose: "STAFF_SEAT" },
            select: { id: true },
          });

          if (staffSeatPayment) {
            hasPaid = true;
          }
        }
      } catch (err) {
        // If DB is momentarily unavailable, fail safe (no access).
        // Log the error for visibility in dev logs.
        console.error("[auth.jwt] hasPaid check failed:", err);
        hasPaid = false;
      }

      token.hasPaid = hasPaid;
      return token;
    },

    // 🎟️ Runs whenever session is accessed on client/server
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

  // 🔄 Use custom login page
  pages: {
    signIn: "/login",
  },
};

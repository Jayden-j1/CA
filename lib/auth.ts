// lib/auth.ts
//
// Purpose:
// - Configure NextAuth with Prisma + CredentialsProvider.
// - Attach role, businessId, hasPaid flags to the session.
// - Dynamically check payment status on every request to keep access up to date.

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
        // 1. Reject if missing input
        if (!credentials?.email || !credentials.password) {
          throw new Error("Invalid credentials");
        }

        // 2. Find user by email
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user || !user.hashedPassword) throw new Error("Invalid credentials");

        // 3. Validate password with bcrypt
        const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!valid) throw new Error("Invalid credentials");

        // 4. Return safe user data (attached to token/session)
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as "USER" | "BUSINESS_OWNER" | "ADMIN",
          businessId: user.businessId ?? null,
          hasPaid: false, // 🚩 Updated dynamically in JWT callback
        };
      },
    }),
  ],

  // ⚙️ Use JWT-based sessions (lighter, works across serverless)
  session: { strategy: "jwt" },

  callbacks: {
    // 🔑 Runs whenever a JWT is issued/updated
    async jwt({ token, user }) {
      // 1. First login: copy values from user
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId ?? null;
      }

      // 2. Re-check "hasPaid" every request
      // Only PACKAGE purchases unlock content
      const payment = await prisma.payment.findFirst({
        where: { userId: token.id as string, purpose: "PACKAGE" },
      });
      token.hasPaid = Boolean(payment);

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

// lib/auth.ts
//
// Purpose:
// - Configure NextAuth with Prisma + CredentialsProvider.
// - Attach role, businessId, hasPaid flags to session.
// - Dynamically check payment status on every request.

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

        // Lookup user
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user || !user.hashedPassword) throw new Error("Invalid credentials");

        // Verify password
        const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!valid) throw new Error("Invalid credentials");

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as "USER" | "BUSINESS_OWNER" | "ADMIN",
          businessId: user.businessId ?? null,
          hasPaid: false, // updated below
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      // Copy user props on login
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId ?? null;
      }

      // Always re-check payments (only PACKAGE unlocks access)
      const payment = await prisma.payment.findFirst({
        where: { userId: token.id as string, purpose: "PACKAGE" },
      });
      token.hasPaid = Boolean(payment);

      return token;
    },

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

  pages: {
    signIn: "/login",
  },
};

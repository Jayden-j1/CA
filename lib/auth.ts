// lib/auth.ts
//
// Purpose:
// - Configure NextAuth with Prisma + CredentialsProvider.
// - Support login via email/password (credentials).
// - Compare plain text password against stored bcrypt hash.
// - Expose role + businessId in JWT/session for frontend role-based UI.
//
// Notes:
// - OAuth providers can be added later (e.g. Google).
// - Uses JWT sessions for scalability.

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
        // 1. Validate input
        if (!credentials?.email || !credentials.password) {
          console.warn("[NextAuth] Missing email or password");
          return null;
        }

        // 2. Find user
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) {
          console.warn("[NextAuth] No user found:", credentials.email);
          return null;
        }

        // 3. Ensure password exists (OAuth users may not have one)
        if (!user.hashedPassword) {
          console.warn("[NextAuth] User exists but has no password:", credentials.email);
          return null;
        }

        // 4. Compare bcrypt hash
        const isValid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!isValid) {
          console.warn("[NextAuth] Invalid password for:", credentials.email);
          return null;
        }

        console.log("[NextAuth] Successful login:", { id: user.id, role: user.role });
        return user;
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    // Attach custom fields to JWT
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId ?? null;
      }
      return token;
    },
    // Attach JWT fields to session
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.businessId = (token.businessId as string) ?? null;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
};

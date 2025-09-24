// lib/auth.ts
//
// Purpose:
// - Configure NextAuth with Prisma + CredentialsProvider.
// - Distinguish between invalid credentials vs system-level errors.
// - System errors are wrapped in { systemError: true } so frontend can detect them.
// - Attach role + businessId to JWT/session for role-based UI.
//
// Notes:
// - Uses Prisma adapter.
// - OAuth providers (Google, etc.) can be added later.
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
        try {
          // ------------------------------
          // 1. Validate input
          // ------------------------------
          if (!credentials?.email || !credentials.password) {
            throw new Error("Invalid credentials");
          }

          // ------------------------------
          // 2. Find user in DB
          // ------------------------------
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });
          if (!user) {
            throw new Error("Invalid credentials");
          }

          // ------------------------------
          // 3. Ensure user has a password (not just OAuth)
          // ------------------------------
          if (!user.hashedPassword) {
            throw new Error("Invalid credentials");
          }

          // ------------------------------
          // 4. Compare bcrypt hash
          // ------------------------------
          const isValid = await bcrypt.compare(
            credentials.password,
            user.hashedPassword
          );
          if (!isValid) {
            throw new Error("Invalid credentials");
          }

          // ------------------------------
          // 5. Success → return user
          // ------------------------------
          console.log("[NextAuth] Successful login:", {
            id: user.id,
            role: user.role,
          });
          return user;
        } catch (err) {
          console.error("❌ [NextAuth] Credentials provider error:", err);

          // Distinguish error types
          if (err instanceof Error && err.message === "Invalid credentials") {
            throw err; // → frontend shows role-aware error toast
          }

          // Anything else → system-level failure
          throw new Error(JSON.stringify({ systemError: true }));
        }
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    // ------------------------------
    // Add custom fields to JWT
    // ------------------------------
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId ?? null;
      }
      return token;
    },
    // ------------------------------
    // Add JWT fields to session
    // ------------------------------
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










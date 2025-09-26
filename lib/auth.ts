// lib/auth.ts
//
// Purpose:
// - Configure NextAuth with Prisma + CredentialsProvider.
// - Add role, businessId, and hasPaid flags to JWT/session.
// - Ensure user payment status (`hasPaid`) is dynamically checked via Prisma.
//
// Fixes:
// - Properly shapes `authorize()` return object so NextAuth accepts it.
// - Avoids type errors by narrowing fields.
// - Always re-checks payment state during `jwt` callback (not only login).
//
// Notes:
// - Requires `types/next-auth.d.ts` (see below) for TS augmentation.
// - Requires `tsconfig.json` to include `"typeRoots": ["./types", "./node_modules/@types"]`.

import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  // ✅ Link Prisma so NextAuth persists users/sessions in DB
  adapter: PrismaAdapter(prisma),

  // ✅ Credentials login (email + password)
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          // 1. Ensure inputs exist
          if (!credentials?.email || !credentials.password) {
            throw new Error("Invalid credentials");
          }

          // 2. Lookup user in Prisma DB
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });
          if (!user) throw new Error("Invalid credentials");

          // 3. Ensure account is password-based
          if (!user.hashedPassword) throw new Error("Invalid credentials");

          // 4. Verify password against bcrypt hash
          const isValid = await bcrypt.compare(
            credentials.password,
            user.hashedPassword
          );
          if (!isValid) throw new Error("Invalid credentials");

          // 5. Return minimal object that matches NextAuth `User`
          //    (this is passed into jwt() callback as `user`)
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role as "USER" | "BUSINESS_OWNER" | "ADMIN",
            businessId: user.businessId ?? null,
            hasPaid: false, // ✅ placeholder — real check below in jwt()
          };
        } catch (err) {
          console.error("❌ [NextAuth] authorize() error:", err);

          // Distinguish invalid credentials vs system error
          if (err instanceof Error && err.message === "Invalid credentials") {
            throw err; // → handled gracefully in frontend
          }

          // Anything else → system error flag
          throw new Error(JSON.stringify({ systemError: true }));
        }
      },
    }),
  ],

  // ✅ We want JWT-based sessions (scalable, stateless)
  session: { strategy: "jwt" },

  callbacks: {
    // -------------------------
    // JWT callback
    // Runs whenever a token is created/updated (login + subsequent requests)
    // -------------------------
    async jwt({ token, user }) {
      // If just logged in → copy over user props
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId ?? null;
      }

      // Always dynamically re-check hasPaid from DB
      try {
        const payment = await prisma.payment.findFirst({
          where: { userId: token.id as string },
        });
        token.hasPaid = Boolean(payment); // ✅ ensure boolean (not object)
      } catch (err) {
        console.error("[NextAuth] hasPaid check failed:", err);
        token.hasPaid = false;
      }

      return token;
    },

    // -------------------------
    // Session callback
    // Runs when session is checked client-side (useSession)
    // -------------------------
    async session({ session, token }) {
      if (session.user) {
        // Copy custom fields from token → session
        session.user.id = token.id as string;
        session.user.role = token.role as "USER" | "BUSINESS_OWNER" | "ADMIN";
        session.user.businessId = (token.businessId as string) ?? null;
        session.user.hasPaid = Boolean(token.hasPaid); // ✅ enforce boolean
      }
      return session;
    },
  },

  pages: {
    signIn: "/login", // Custom login page
  },
};

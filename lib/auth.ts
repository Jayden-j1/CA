// lib/auth.ts
//
// Purpose
// -------
// - Configure NextAuth with Prisma + CredentialsProvider.
// - Attach role, businessId, hasPaid, isActive, and mustChangePassword flags to the session.
// - Enforce soft deletion: inactive users cannot log in or access resources.
// - NEW (2025-10): Reflect "hasPaid" (and other flags) from the DB on *every session*
//   so the UI updates immediately after Stripe success (via webhook -> DB -> session).
//
// Why this change?
// ----------------
// Previously, `jwt()` queried payments to compute `hasPaid`. That works, but
// it's simpler & more robust to read the *single source of truth* (your User row)
// inside the `session()` callback. Your Stripe webhook sets `user.hasPaid = true`,
// and the next page load will mirror that instantly.
//
// Pillars
// -------
// ✅ Efficiency  – one short DB lookup in `session()`
// ✅ Robustness  – always mirrors DB truth (post-webhook)
// ✅ Simplicity  – no scattered payment lookups in auth callbacks
// ✅ Ease of mgmt – keep existing provider & adapter; just refine callbacks
// ✅ Security    – soft-delete honored; never trusts client input

import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  // Keep your Prisma adapter (accounts/sessions tables etc.)
  adapter: PrismaAdapter(prisma),

  // We use JWT sessions (App Router default) for stateless performance
  session: { strategy: "jwt" },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // 1) Basic input guard
        if (!credentials?.email || !credentials.password) {
          throw new Error("Invalid credentials");
        }

        // 2) Find user by email (minimal select is fine here)
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        // 3) Soft-delete enforcement + password presence
        const active = user?.isActive ?? true;
        if (!user || !user.hashedPassword || active === false) {
          throw new Error("Invalid credentials or inactive account");
        }

        // 4) Verify password
        const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!valid) throw new Error("Invalid credentials");

        // 5) Return a minimal safe object; the session() callback will load fresh DB truth
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as "USER" | "BUSINESS_OWNER" | "ADMIN",
          businessId: user.businessId ?? null,
          isActive: active,
          mustChangePassword: user.mustChangePassword ?? false,
          // NOTE: we don't compute hasPaid here; session() will mirror DB truth
          hasPaid: false,
        };
      },
    }),
  ],

  callbacks: {
    /**
     * jwt()
     * ------
     * Seed stable identifiers on sign-in and keep token small.
     * We intentionally DO NOT compute hasPaid here anymore.
     * The session() callback will always fetch the latest DB flags.
     */
    async jwt({ token, user }) {
      // On first sign-in, copy core IDs/role from the returned user
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.businessId = (user as any).businessId ?? null;
        token.isActive = (user as any).isActive;
        token.mustChangePassword = (user as any).mustChangePassword ?? false;
      }

      // If a token exists but user is inactive, keep that state sticky
      if (token.isActive === false) {
        return token;
      }

      // Do not compute hasPaid here anymore (single source of truth in session()).
      return token;
    },

    /**
     * session()
     * ----------
     * Mirror the latest DB truth into the session on each request:
     * role, businessId, hasPaid, isActive, mustChangePassword.
     * This makes the UI update instantly after Stripe success (webhook has flipped user.hasPaid).
     */
    async session({ session, token }) {
      // If we don't have a user id in the token, return as-is
      const userId = token?.id as string | undefined;
      if (!userId || !session.user) return session;

      try {
        // Load the *latest* truth from the DB
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            role: true,
            businessId: true,
            hasPaid: true,
            isActive: true,
            mustChangePassword: true,
          },
        });

        if (dbUser) {
          // Soft-delete guard still enforced via isActive
          session.user.id = dbUser.id;
          session.user.email = dbUser.email || session.user.email || "";
          session.user.role = (dbUser.role as "USER" | "BUSINESS_OWNER" | "ADMIN") || "USER";
          session.user.businessId = dbUser.businessId ?? null;
          session.user.hasPaid = Boolean(dbUser.hasPaid); // ✅ live reflect after Stripe webhook
          session.user.isActive = dbUser.isActive ?? true;
          session.user.mustChangePassword = dbUser.mustChangePassword ?? false;
        } else {
          // If user disappeared, keep session minimal
          session.user.id = userId;
          session.user.hasPaid = false;
          session.user.isActive = false;
        }
      } catch (e) {
        // Fail-safe: keep existing session values if DB temporarily fails
        console.warn("[auth.session] DB lookup failed; using existing session:", e);
        session.user.hasPaid = Boolean(session.user.hasPaid);
        session.user.isActive = (session.user.isActive as boolean) ?? true;
      }

      return session;
    },
  },

  // Keep your custom pages
  pages: { signIn: "/login" },
};

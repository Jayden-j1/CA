// lib/auth.ts
//
// Purpose
// -------
// NextAuth config that mirrors DB truth (hasPaid, role, etc.) on each request,
// so the UI updates immediately after Stripe webhook writes to the DB.

import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

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

        const user = await prisma.user.findUnique({ where: { email: credentials.email } });

        const active = user?.isActive ?? true;
        if (!user || !user.hashedPassword || active === false) {
          throw new Error("Invalid credentials or inactive account");
        }

        const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!valid) throw new Error("Invalid credentials");

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as "USER" | "BUSINESS_OWNER" | "ADMIN",
          businessId: user.businessId ?? null,
          isActive: active,
          mustChangePassword: user.mustChangePassword ?? false,
          hasPaid: false, // session() will fetch live value
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.businessId = (user as any).businessId ?? null;
        token.isActive = (user as any).isActive;
        token.mustChangePassword = (user as any).mustChangePassword ?? false;
      }

      // Keep token small; hasPaid fetched in session()
      return token;
    },

    async session({ session, token }) {
      const userId = token?.id as string | undefined;
      if (!userId || !session.user) return session;

      try {
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
          session.user.id = dbUser.id;
          session.user.email = dbUser.email || session.user.email || "";
          session.user.role = (dbUser.role as "USER" | "BUSINESS_OWNER" | "ADMIN") || "USER";
          session.user.businessId = dbUser.businessId ?? null;
          session.user.hasPaid = Boolean(dbUser.hasPaid);
          session.user.isActive = dbUser.isActive ?? true;
          session.user.mustChangePassword = dbUser.mustChangePassword ?? false;
        } else {
          session.user.id = userId;
          session.user.hasPaid = false;
          session.user.isActive = false;
        }
      } catch (e) {
        console.warn("[auth.session] DB lookup failed; using existing session:", e);
        session.user.hasPaid = Boolean(session.user.hasPaid);
        session.user.isActive = (session.user.isActive as boolean) ?? true;
      }

      return session;
    },
  },

  pages: { signIn: "/login" },
};

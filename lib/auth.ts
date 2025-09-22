// lib/auth.ts
//
// This file configures NextAuth with Prisma + CredentialsProvider.
// - Handles both credentials login (email/password) and OAuth logins.
// - Safely checks for null passwords (OAuth users won't have one).
// - Stores role + businessId in JWT/session so you can use them on the frontend.

import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";

//  Exported authOptions so it can be imported in [...nextauth]/route.ts
export const authOptions: NextAuthOptions = {
  // Prisma adapter lets NextAuth persist users/sessions into your DB
  adapter: PrismaAdapter(prisma),

  // Providers = different login methods
  providers: [
    // --- 1) Email + Password login ---
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        //  Validate input
        if (!credentials?.email || !credentials.password) {
          return null; // reject login if email or password is missing
        }

        // Find user by email
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          return null; // no user found with this email
        }

        // If no password is stored (e.g. OAuth account), reject login
        if (!user.password) {
          return null;
        }

        // Compare submitted password with hashed password in DB
        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isValid) {
          return null; // password mismatch
        }

        //  Return full user object → becomes `user` in callbacks
        return user;
      },
    }),

    // --- 2) Example OAuth Provider (Google) ---
    // Uncomment if you want OAuth login too
    /*
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    */
  ],

  // Use JWT instead of database sessions (scales better)
  session: { strategy: "jwt" },

  // Callbacks let us customize the token and session
  callbacks: {
    // Called whenever a JWT is created/updated
    async jwt({ token, user }) {
      if (user) {
        // On login, add custom fields to token
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId ?? null;
      }
      return token;
    },

    // Called whenever `useSession()` or `getServerSession()` runs
    async session({ session, token }) {
      if (session.user) {
        // Attach our custom fields from token to the session user
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.businessId = (token.businessId as string) ?? null;
      }
      return session;
    },
  },

  // Custom page routes
  pages: {
    signIn: "/login", // where NextAuth should redirect for login
  },
};

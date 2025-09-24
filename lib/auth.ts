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









// // lib/auth.ts
// //
// // Purpose:
// // - Configure NextAuth with Prisma + CredentialsProvider.
// // - Wrap backend/system errors in { systemError: true } so frontend can
// //   detect them and show purple toasts.
// // - Distinguish invalid credentials from unexpected failures.
// // - Attach role + businessId to JWT/session for role-based UI.

// import { PrismaAdapter } from "@next-auth/prisma-adapter";
// import { prisma } from "./prisma";
// import CredentialsProvider from "next-auth/providers/credentials";
// import type { NextAuthOptions } from "next-auth";
// import bcrypt from "bcryptjs";

// export const authOptions: NextAuthOptions = {
//   adapter: PrismaAdapter(prisma),

//   providers: [
//     CredentialsProvider({
//       name: "Credentials",
//       credentials: {
//         email: { label: "Email", type: "email" },
//         password: { label: "Password", type: "password" },
//       },
//       async authorize(credentials) {
//         try {
//           // ------------------------------
//           // 1. Validate input
//           // ------------------------------
//           if (!credentials?.email || !credentials.password) {
//             throw new Error("Invalid credentials");
//           }

//           // ------------------------------
//           // 2. Look up user by email
//           // ------------------------------
//           const user = await prisma.user.findUnique({
//             where: { email: credentials.email },
//           });
//           if (!user) {
//             throw new Error("Invalid credentials");
//           }

//           // ------------------------------
//           // 3. Ensure user has password (not just OAuth)
//           // ------------------------------
//           if (!user.hashedPassword) {
//             throw new Error("Invalid credentials");
//           }

//           // ------------------------------
//           // 4. Compare bcrypt hash
//           // ------------------------------
//           const isValid = await bcrypt.compare(
//             credentials.password,
//             user.hashedPassword
//           );
//           if (!isValid) {
//             throw new Error("Invalid credentials");
//           }

//           // ------------------------------
//           // 5. Success → return minimal user info
//           // ------------------------------
//           console.log("[NextAuth] Successful login:", {
//             id: user.id,
//             role: user.role,
//           });
//           return user;
//         } catch (err) {
//           console.error("❌ [NextAuth] Credentials provider error:", err);

//           // ------------------------------
//           // Distinguish invalid credentials vs system failures
//           // ------------------------------
//           if (err instanceof Error && err.message === "Invalid credentials") {
//             throw err; // frontend → role error toast
//           }

//           // Wrap system errors in JSON so frontend can detect
//           throw new Error(JSON.stringify({ systemError: true }));
//         }
//       },
//     }),
//   ],

//   session: { strategy: "jwt" },

//   callbacks: {
//     // ------------------------------
//     // Attach custom fields to JWT
//     // ------------------------------
//     async jwt({ token, user }) {
//       if (user) {
//         token.id = user.id;
//         token.role = user.role;
//         token.businessId = user.businessId ?? null;
//       }
//       return token;
//     },
//     // ------------------------------
//     // Attach JWT fields to session
//     // ------------------------------
//     async session({ session, token }) {
//       if (session.user) {
//         session.user.id = token.id as string;
//         session.user.role = token.role as string;
//         session.user.businessId = (token.businessId as string) ?? null;
//       }
//       return session;
//     },
//   },

//   pages: {
//     signIn: "/login",
//   },
// };









// // lib/auth.ts
// //
// // Purpose:
// // - Configure NextAuth with Prisma + CredentialsProvider.
// // - Support login via email/password (credentials).
// // - Compare plain text password against stored bcrypt hash.
// // - Expose role + businessId in JWT/session for frontend role-based UI.
// //
// // Notes:
// // - OAuth providers can be added later (e.g. Google).
// // - Uses JWT sessions for scalability.

// import { PrismaAdapter } from "@next-auth/prisma-adapter";
// import { prisma } from "./prisma";
// import CredentialsProvider from "next-auth/providers/credentials";
// import type { NextAuthOptions } from "next-auth";
// import bcrypt from "bcryptjs";

// export const authOptions: NextAuthOptions = {
//   adapter: PrismaAdapter(prisma),

//   providers: [
//     CredentialsProvider({
//       name: "Credentials",
//       credentials: {
//         email: { label: "Email", type: "email" },
//         password: { label: "Password", type: "password" },
//       },
//       async authorize(credentials) {
//         // 1. Validate input
//         if (!credentials?.email || !credentials.password) {
//           console.warn("[NextAuth] Missing email or password");
//           return null;
//         }

//         // 2. Find user
//         const user = await prisma.user.findUnique({
//           where: { email: credentials.email },
//         });
//         if (!user) {
//           console.warn("[NextAuth] No user found:", credentials.email);
//           return null;
//         }

//         // 3. Ensure password exists (OAuth users may not have one)
//         if (!user.hashedPassword) {
//           console.warn("[NextAuth] User exists but has no password:", credentials.email);
//           return null;
//         }

//         // 4. Compare bcrypt hash
//         const isValid = await bcrypt.compare(credentials.password, user.hashedPassword);
//         if (!isValid) {
//           console.warn("[NextAuth] Invalid password for:", credentials.email);
//           return null;
//         }

//         console.log("[NextAuth] Successful login:", { id: user.id, role: user.role });
//         return user;
//       },
//     }),
//   ],

//   session: { strategy: "jwt" },

//   callbacks: {
//     // Attach custom fields to JWT
//     async jwt({ token, user }) {
//       if (user) {
//         token.id = user.id;
//         token.role = user.role;
//         token.businessId = user.businessId ?? null;
//       }
//       return token;
//     },
//     // Attach JWT fields to session
//     async session({ session, token }) {
//       if (session.user) {
//         session.user.id = token.id as string;
//         session.user.role = token.role as string;
//         session.user.businessId = (token.businessId as string) ?? null;
//       }
//       return session;
//     },
//   },

//   pages: {
//     signIn: "/login",
//   },
// };

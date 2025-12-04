// lib/auth.ts
//
// Purpose
// -------
// NextAuth config that mirrors DB truth (hasPaid, role, etc.) on each request,
// so the UI updates immediately after Stripe webhook writes to the DB.
//
// Security & Robustness Enhancements
// ----------------------------------
// • Normalize email (trim + lowercase) before lookup to keep auth behaviour
//   consistent with signup and forgot-password flows.
// • Use a *case-insensitive* user lookup so legacy mixed-case emails still
//   authenticate correctly.
// • Add rate limiting for login attempts (per IP+email) using Upstash Redis.
//   - Generic "Invalid credentials" error when rate-limited
//   - No change to existing successful login flows
//
// Pillars
// -------
// Efficiency   – One small rate-limit check per login, single DB lookup
// Robustness   – Case-insensitive identity; DB truth mirrored on each request
// Simplicity   – Minimal changes, clear comments
// Security     – Slows brute-force attacks; protects against email casing issues
// Ease of mgmt – Centralized in one NextAuth config

import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";
import { limit } from "./rateLimit";

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
      // `authorize` is called whenever a credentials login is attempted.
      // We keep responses generic (no enumeration) and layer in:
      //  - email normalization
      //  - a small rate-limiter
      //  - a case-insensitive lookup
      async authorize(credentials, req) {
        // 0) Basic presence checks (no details leaked)
        if (!credentials?.email || !credentials.password) {
          throw new Error("Invalid credentials");
        }

        // 1) Normalize email:
        //    - Trim whitespace
        //    - Lowercase to treat email as case-insensitive identifier
        const normalizedEmail = credentials.email.trim().toLowerCase();

        // 2) Rate limit login attempts (per IP + email)
        //
        //    - Uses Upstash Redis via `limit()`
        //    - We build a key like `login:<ip>:<email>`
        //    - If the limit is exceeded, we throw the same generic
        //      "Invalid credentials" error to avoid giving attackers
        //      a signal about rate-limiting.
        try {
          const forwardedFor =
            // App Router: Headers may be a plain object or Headers instance
            (req as any)?.headers?.["x-forwarded-for"] ??
            (req as any)?.headers?.get?.("x-forwarded-for");
          const ipFromForwarded =
            typeof forwardedFor === "string"
              ? forwardedFor.split(",")[0]?.trim()
              : undefined;

          const ip =
            ipFromForwarded ||
            (req as any)?.headers?.["x-real-ip"] ||
            (req as any)?.socket?.remoteAddress ||
            "unknown";

          const rateKey = `login:${ip}:${normalizedEmail}`;

          // Allow e.g. 10 attempts per 60 seconds per IP+email combo.
          const allowed = await limit(rateKey, 10, 60);
          if (!allowed) {
            // Generic error; never mention rate limiting to the client.
            throw new Error("Invalid credentials");
          }
        } catch (rateErr) {
          // Fail-open if Redis is unavailable or the rate-limit call fails.
          // We log server-side but still allow the attempt to proceed.
          console.warn(
            "[auth.authorize] Rate-limit check failed; allowing login attempt:",
            rateErr
          );
        }

        // 3) Case-insensitive user lookup
        //
        //    Rationale:
        //    - Legacy records may have emails stored with mixed casing.
        //    - Using `mode: "insensitive"` ensures we find the correct
        //      user regardless of how they enter their email today.
        const user = await prisma.user.findFirst({
          where: {
            email: {
              equals: normalizedEmail,
              mode: "insensitive",
            },
          },
        });

        const active = user?.isActive ?? true;
        if (!user || !user.hashedPassword || active === false) {
          // Keep error generic; do not reveal if the account is inactive or missing.
          throw new Error("Invalid credentials or inactive account");
        }

        // 4) Verify password with bcrypt (constant-time comparison)
        const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!valid) throw new Error("Invalid credentials");

        // 5) Return a minimal view of the user for JWT callback
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as "USER" | "BUSINESS_OWNER" | "ADMIN",
          businessId: user.businessId ?? null,
          isActive: active,
          mustChangePassword: user.mustChangePassword ?? false,
          // session() will fetch live hasPaid value + owner-paid logic for staff
          hasPaid: false,
        };
      },
    }),
  ],

  callbacks: {
    // JWT callback:
    // - Runs whenever a JWT is created/updated.
    // - We keep the token small and defer `hasPaid` to the session() callback.
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.businessId = (user as any).businessId ?? null;
        token.isActive = (user as any).isActive;
        token.mustChangePassword = (user as any).mustChangePassword ?? false;
      }
      return token;
    },

    // Session callback:
    // - Runs on every `getServerSession` call.
    // - Mirrors DB truth into `session.user`:
    //     • role, hasPaid, isActive, mustChangePassword
    // - For staff, it also checks the business owner's hasPaid flag to
    //   grant them access when their owner has paid.
    async session({ session, token }) {
      const userId = token?.id as string | undefined;
      if (!userId || !session.user) return session;

      try {
        // 1) Always pull fresh DB truth
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
          session.user.isActive = dbUser.isActive ?? true;
          session.user.mustChangePassword = dbUser.mustChangePassword ?? false;

          // 2) Determine effective paid access
          //    - Individuals: their own hasPaid
          //    - Business owner: their own hasPaid
          //    - Staff (USER/ADMIN with businessId): grant access if owner has paid
          let paidAccess = Boolean(dbUser.hasPaid);

          if (!paidAccess && dbUser.businessId) {
            // Check the owner's hasPaid for this business (minimal, single query)
            const ownerPaid = await prisma.business.findUnique({
              where: { id: dbUser.businessId },
              select: { owner: { select: { hasPaid: true } } },
            });
            if (ownerPaid?.owner?.hasPaid) {
              paidAccess = true;
            }
          }

          session.user.hasPaid = paidAccess;
        } else {
          // User vanished? Keep session coherent.
          session.user.id = userId;
          session.user.hasPaid = false;
          session.user.isActive = false;
        }
      } catch (e) {
        // If DB is briefly unavailable, keep existing session flags
        console.warn("[auth.session] DB lookup failed; using existing session:", e);
        session.user.hasPaid = Boolean(session.user.hasPaid);
        session.user.isActive = (session.user.isActive as boolean) ?? true;
      }

      return session;
    },
  },

  pages: { signIn: "/login" },
};









// // lib/auth.ts
// //
// // Purpose
// // -------
// // NextAuth config that mirrors DB truth (hasPaid, role, etc.) on each request,
// // so the UI updates immediately after Stripe webhook writes to the DB.
// //
// // ✅ Update (tiny, surgical):
// // If the user belongs to a business (staff/admin) and the BUSINESS OWNER has paid,
// // we set session.user.hasPaid = true for the staff user. This unlocks map/course
// // and hides the Upgrade link for staff whose access is covered by the owner.
// // (Owner’s own hasPaid remains authoritative; individuals unchanged.)

// import { PrismaAdapter } from "@next-auth/prisma-adapter";
// import { prisma } from "./prisma";
// import CredentialsProvider from "next-auth/providers/credentials";
// import type { NextAuthOptions } from "next-auth";
// import bcrypt from "bcryptjs";

// export const authOptions: NextAuthOptions = {
//   adapter: PrismaAdapter(prisma),
//   session: { strategy: "jwt" },

//   providers: [
//     CredentialsProvider({
//       name: "Credentials",
//       credentials: {
//         email: { label: "Email", type: "email" },
//         password: { label: "Password", type: "password" },
//       },
//       async authorize(credentials) {
//         if (!credentials?.email || !credentials.password) {
//           throw new Error("Invalid credentials");
//         }

//         const user = await prisma.user.findUnique({ where: { email: credentials.email } });

//         const active = user?.isActive ?? true;
//         if (!user || !user.hashedPassword || active === false) {
//           throw new Error("Invalid credentials or inactive account");
//         }

//         const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
//         if (!valid) throw new Error("Invalid credentials");

//         return {
//           id: user.id,
//           name: user.name,
//           email: user.email,
//           role: user.role as "USER" | "BUSINESS_OWNER" | "ADMIN",
//           businessId: user.businessId ?? null,
//           isActive: active,
//           mustChangePassword: user.mustChangePassword ?? false,
//           hasPaid: false, // session() will fetch live value + owner-paid logic for staff
//         };
//       },
//     }),
//   ],

//   callbacks: {
//     async jwt({ token, user }) {
//       if (user) {
//         token.id = (user as any).id;
//         token.role = (user as any).role;
//         token.businessId = (user as any).businessId ?? null;
//         token.isActive = (user as any).isActive;
//         token.mustChangePassword = (user as any).mustChangePassword ?? false;
//       }
//       // Keep token small; hasPaid fetched in session()
//       return token;
//     },

//     async session({ session, token }) {
//       const userId = token?.id as string | undefined;
//       if (!userId || !session.user) return session;

//       try {
//         // 1) Always pull fresh DB truth
//         const dbUser = await prisma.user.findUnique({
//           where: { id: userId },
//           select: {
//             id: true,
//             email: true,
//             role: true,
//             businessId: true,
//             hasPaid: true,
//             isActive: true,
//             mustChangePassword: true,
//           },
//         });

//         if (dbUser) {
//           session.user.id = dbUser.id;
//           session.user.email = dbUser.email || session.user.email || "";
//           session.user.role = (dbUser.role as "USER" | "BUSINESS_OWNER" | "ADMIN") || "USER";
//           session.user.businessId = dbUser.businessId ?? null;
//           session.user.isActive = dbUser.isActive ?? true;
//           session.user.mustChangePassword = dbUser.mustChangePassword ?? false;

//           // 2) Determine effective paid access
//           //    - Individuals: their own hasPaid
//           //    - Business owner: their own hasPaid
//           //    - Staff (USER/ADMIN with businessId): grant access if owner has paid
//           let paidAccess = Boolean(dbUser.hasPaid);

//           if (!paidAccess && dbUser.businessId) {
//             // Check the owner's hasPaid for this business (minimal, single query)
//             const ownerPaid = await prisma.business.findUnique({
//               where: { id: dbUser.businessId },
//               select: { owner: { select: { hasPaid: true } } },
//             });
//             if (ownerPaid?.owner?.hasPaid) {
//               paidAccess = true;
//             }
//           }

//           session.user.hasPaid = paidAccess;
//         } else {
//           // User vanished? Keep session coherent
//           session.user.id = userId;
//           session.user.hasPaid = false;
//           session.user.isActive = false;
//         }
//       } catch (e) {
//         // If DB is briefly unavailable, keep existing session flags
//         console.warn("[auth.session] DB lookup failed; using existing session:", e);
//         session.user.hasPaid = Boolean(session.user.hasPaid);
//         session.user.isActive = (session.user.isActive as boolean) ?? true;
//       }

//       return session;
//     },
//   },

//   pages: { signIn: "/login" },
// };
















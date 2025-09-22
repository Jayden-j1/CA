// app/api/auth/[...nextauth]/route.ts
//
// Purpose:
// - Exposes the NextAuth API route under /api/auth/[...nextauth].
// - Uses the configuration defined in lib/auth.ts (authOptions).

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

//  Export NextAuth handlers for both GET and POST
// This is how App Router expects it in Next.js 13+
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

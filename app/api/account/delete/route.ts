// app/api/account/delete/route.ts
//
// Purpose:
// - Allow an authenticated user to delete (deactivate) their own account.
// - We perform a "soft delete" by setting `isActive = false`, mirroring staff removal:
//     • Preserves payment history and avoids foreign-key issues.
//     • You can filter active users via `isActive = true`.
// - Requires the user to provide their current password for security.
//
// Requirements:
// - User model has: `id`, `email`, `isActive Boolean @default(true)`,
//   and a password hash field named `hashedPassword`.
// - `session.user` is available via NextAuth (see `types/next-auth.d.ts`).
//
// Notes on implementation:
// - We do NOT touch any other flows (signup, login, staff, payments).
// - We resolve the user via `session.user.id` if available,
//   otherwise we fall back to `session.user.email`.
// - We now explicitly use the `hashedPassword` field from the User record,
//   which matches your Prisma schema.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    // ---------------------------------------------------
    // 1) Require an authenticated user (same pattern as staff/remove)
    // ---------------------------------------------------
    // We only check that `session.user` exists here (not strictly `session.user.id`),
    // because some session callbacks may occasionally fail to enrich the session with `id`
    // if Prisma temporarily has connection issues.
    //
    // This mirrors the stable pattern already used in `app/api/staff/remove/route.ts`:
    //   if (!session?.user) { return 401; }
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    // ---------------------------------------------------
    // 2) Parse body and validate input
    // ---------------------------------------------------
    const { password } = await req.json();

    // We require a non-empty password string to proceed.
    if (typeof password !== "string" || password.trim().length === 0) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    // ---------------------------------------------------
    // 3) Resolve which user to delete (by id, then by email)
    // ---------------------------------------------------
    // We try to use `session.user.id` if it's present (ideal case).
    // If it's not present, we fall back to `session.user.email`, which:
    //   - is unique in your credentials login flow,
    //   - is part of the standard NextAuth session shape.
    const sessionUser: any = session.user;
    const userIdFromSession = sessionUser.id as string | undefined;
    const userEmailFromSession = sessionUser.email as string | undefined;

    if (!userIdFromSession && !userEmailFromSession) {
      // Highly unusual: we have `session.user` but neither an id nor an email.
      // We fail loudly but safely, without exposing internal details.
      return NextResponse.json(
        { error: "Unable to identify account for deletion" },
        { status: 400 }
      );
    }

    // Build a Prisma "where" clause using whichever unique identifier we have.
    const whereClause = userIdFromSession
      ? { id: userIdFromSession }
      : { email: userEmailFromSession! };

    // ---------------------------------------------------
    // 4) Fetch the user from the database
    // ---------------------------------------------------
    // We fetch the DB user to:
    //   - ensure it actually exists,
    //   - retrieve the stored password hash for comparison.
    const user = await prisma.user.findUnique({
      where: whereClause,
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // ---------------------------------------------------
    // 5) Verify password against stored hash
    // ---------------------------------------------------
    // IMPORTANT:
    // Your Prisma schema uses a column named `hashedPassword`, not `passwordHash`.
    // So we read `user.hashedPassword` here to match your actual DB structure.
    //
    // If you ever rename this field in `schema.prisma`, update it here as well.
    const passwordHash = (user as any).hashedPassword;

    if (!passwordHash) {
      // Safety check: if for some reason the user has no stored hash
      // (e.g. legacy account or an incomplete migration), we deny deletion.
      return NextResponse.json(
        { error: "Account cannot be deleted: no password hash found" },
        { status: 400 }
      );
    }

    // Compare the plain-text password from the form with the hashed password
    // stored in the database using bcrypt.
    const isMatch = await bcrypt.compare(password, passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 400 }
      );
    }

    // ---------------------------------------------------
    // 6) Soft delete the user (isActive = false)
    // ---------------------------------------------------
    // This mirrors the staff removal strategy:
    //   - avoids foreign key issues,
    //   - preserves payment and audit history,
    //   - and keeps your queries simple (filter by isActive = true).
    await prisma.user.update({
      where: whereClause,
      data: {
        isActive: false,
      },
    });

    // ---------------------------------------------------
    // 7) Return success
    // ---------------------------------------------------
    // The frontend (`app/dashboard/delete-account/page.tsx`) will:
    //   - close the confirmation modal,
    //   - redirect the user to `/logout` so the session is cleared.
    return NextResponse.json({ message: "Account deleted" }, { status: 200 });
  } catch (error) {
    // Log full error server-side for debugging, but return a generic message
    // to avoid leaking implementation details to the client.
    console.error("[API] Account delete error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

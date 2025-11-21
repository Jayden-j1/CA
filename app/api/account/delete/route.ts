// app/api/account/delete/route.ts
//
// Purpose:
// - Allow an authenticated user to delete (deactivate) their own account.
// - We perform a "soft delete" by setting isActive = false, mirroring staff removal:
//     • Preserves payment history and avoids FK issues.
//     • You can filter active users via isActive = true.
// - Requires the user to provide their current password for security.
//
// Requirements:
// - User model has: id, isActive Boolean @default(true), and a password hash field (e.g. passwordHash).
// - Session.user.id is available via NextAuth (see next-auth.d.ts).
//
// IMPORTANT SECURITY NOTE:
// - If your user password field is named differently (e.g. "password" or "hashedPassword"),
//   update the code below in the marked section.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    // 1) Auth required
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Parse body and basic validation
    const { password } = await req.json();

    if (typeof password !== "string" || password.trim().length === 0) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // 3) Find the user record
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 4) Compare provided password with stored password hash
    //    Adjust "passwordHash" if your schema uses a different field name.
    //    e.g., const passwordHash = user.password; or user.hashedPassword, etc.
    const passwordHash = (user as any).passwordHash;

    if (!passwordHash) {
      return NextResponse.json(
        { error: "Account cannot be deleted: no password hash found" },
        { status: 400 }
      );
    }

    const isMatch = await bcrypt.compare(password, passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 400 }
      );
    }

    // 5) Soft delete: mark user as inactive
    //    This keeps payment history and avoids foreign key issues.
    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
      },
    });

    // 6) Success: frontend should now log out the user or redirect away
    return NextResponse.json({ message: "Account deleted" }, { status: 200 });
  } catch (error) {
    console.error("[API] Account delete error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// app/api/change-password/route.ts
//
// Purpose
// -------
// Securely change the current user's password and clear the first-login flag.
// This route is called by the /change-password page.
//
// Behavior
// --------
// - Requires an authenticated session (Credentials provider).
// - Validates input (oldPassword, newPassword, confirmNewPassword).
// - Verifies the old password against the DB hash.
// - Enforces the same strong password rules used at signup.
// - Disallows reusing the same password.
// - Hashes and stores the new password, sets mustChangePassword = false.
//
// Notes
// -----
// - We DO NOT invalidate the current session here because you are using JWT
//   sessions (stateless). Instead, the client re-signs in after success to
//   refresh the JWT so middleware sees mustChangePassword=false immediately.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isStrongPassword } from "@/lib/validator";

export async function POST(req: NextRequest) {
  // 1) Must be logged in
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2) Parse and validate input payload
    const { oldPassword, newPassword, confirmNewPassword } = await req.json();

    if (
      typeof oldPassword !== "string" ||
      typeof newPassword !== "string" ||
      typeof confirmNewPassword !== "string"
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (!oldPassword || !newPassword || !confirmNewPassword) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (newPassword !== confirmNewPassword) {
      return NextResponse.json({ error: "New passwords do not match" }, { status: 400 });
    }

    if (oldPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from the old password" },
        { status: 400 }
      );
    }

    if (!isStrongPassword(newPassword)) {
      return NextResponse.json(
        {
          error:
            "Password too weak: must be 8+ chars and include uppercase, lowercase, number, and special character",
        },
        { status: 400 }
      );
    }

    // 3) Load user and verify the old password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, hashedPassword: true },
    });

    if (!user?.hashedPassword) {
      // If the account was created without a password (e.g., social only),
      // we don't allow a change via this endpoint.
      return NextResponse.json(
        { error: "Password change is not available for this account" },
        { status: 400 }
      );
    }

    const oldMatches = await bcrypt.compare(oldPassword, user.hashedPassword);
    if (!oldMatches) {
      return NextResponse.json({ error: "Old password is incorrect" }, { status: 400 });
    }

    // 4) Hash and store the new password; clear mustChangePassword
    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        hashedPassword: newHash,
        mustChangePassword: false, // ✅ user no longer forced to change at login
      },
    });

    // 5) Return success
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/change-password] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

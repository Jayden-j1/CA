// app/api/business/domain/route.ts
//
// Purpose:
// - Return the "effective" business domain for the current session user
//   (BUSINESS_OWNER or ADMIN with a businessId).
// - If the Business.domain is missing, auto-derive it from the caller's email
//   once and persist it, so future validations are consistent.
//
// Why this endpoint?
// - Client UX: Add Staff page can show "Only @example.com emails are allowed".
// - Backend still enforces the rule in /api/staff/add (cannot be bypassed).
//
// Security:
// - Only BUSINESS_OWNER or ADMIN with a businessId can query.
// - Returns { domain: string } on success, or 400/401/403 if invalid.
//
// Notes:
// - If an ADMIN is not tied to a business (businessId == null), we cannot infer
//   which business to resolve; return 400 in that case.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Helper: derive lowercase domain from an email address. */
function extractDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  const businessId = session.user.businessId || null;

  // Only BUSINESS_OWNER or ADMIN with businessId can resolve a business domain
  if (role !== "BUSINESS_OWNER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!businessId) {
    return NextResponse.json(
      { error: "No business assigned to this account" },
      { status: 400 }
    );
  }

  try {
    // Load business
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, domain: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 400 });
    }

    // If domain missing, auto-derive from the caller's email and persist
    let effectiveDomain = (business.domain || "").toLowerCase().trim();
    if (!effectiveDomain) {
      const callerDomain = extractDomain(session.user.email);
      if (!callerDomain) {
        return NextResponse.json(
          { error: "Unable to derive domain from user email" },
          { status: 400 }
        );
      }

      try {
        const updated = await prisma.business.update({
          where: { id: business.id },
          data: { domain: callerDomain },
          select: { domain: true },
        });
        effectiveDomain = updated.domain.toLowerCase();
        console.log("[Business/Domain] Persisted new domain:", effectiveDomain);
      } catch (e: any) {
        // On uniqueness or other constraints, still return the derived domain (not persisted)
        effectiveDomain = callerDomain;
        console.warn(
          "[Business/Domain] Failed to persist domain; returning derived domain:",
          effectiveDomain
        );
      }
    }

    return NextResponse.json({ domain: effectiveDomain });
  } catch (err) {
    console.error("[Business/Domain] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

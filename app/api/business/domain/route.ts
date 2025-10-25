// app/api/business/domain/route.ts
//
// Purpose
// -------
// Return the *human-visible* company email domain for the current business owner:
//
// Priority:
// 1) Business.emailDomain (if present in DB)
// 2) The owner's email host (e.g. "example.com") as a safe fallback
//
// Why this fixes your symptom:
// - The UI was showing the *internal handle* (Business.domain) like "ehealth-8ox1d1".
// - This endpoint deliberately returns only the email domain suitable for staff validation,
//   e.g. "health.com" so your client shows "@health.com".
//
// Security:
// - Requires an authenticated session.
// - Only BUSINESS_OWNER or ADMIN will get a business-based domain; other roles will get
//   a null with a descriptive error.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function extractEmailDomain(email?: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  const businessId = session.user.businessId;

  // Only business owners/admins (assigned to a business) can resolve a business domain
  if ((role !== "BUSINESS_OWNER" && role !== "ADMIN") || !businessId) {
    return NextResponse.json(
      { error: "No business assigned to your account" },
      { status: 400 }
    );
  }

  // Look up the Business row
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      emailDomain: true,
      owner: { select: { email: true } },
    },
  });

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Prefer stored column; otherwise fall back to the owner’s email host
  const domain = business.emailDomain || extractEmailDomain(business.owner?.email) || null;

  if (!domain) {
    return NextResponse.json(
      { error: "Unable to resolve business email domain" },
      { status: 400 }
    );
  }

  return NextResponse.json({ domain });
}

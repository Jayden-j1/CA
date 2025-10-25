// app/api/business/domain/route.ts
//
// Purpose
// -------
// Return the "effective" org domain for the current user's business,
// plus a clean display label (first label) for user-facing messages.
//   • effectiveDomain: e.g. "health.gov.au"
//   • display:         e.g. "health"
//
// Notes
// -----
// - Read-only; no schema changes required.
// - If Business.emailDomain is missing, we fall back to the owner's email host.
// - This endpoint is used by AddStaffForm to render clear guidance like "@health".

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractEmailDomain } from "@/lib/email/corporate";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = session.user.businessId || null;
  if (!businessId) {
    return NextResponse.json({ error: "No business assigned" }, { status: 400 });
  }

  // Load business and owner email
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { owner: { select: { email: true } } },
  });

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Prefer stored emailDomain; fall back to owner email host
  const fromDb = (business.emailDomain || "").toLowerCase();
  const fallback = business.owner?.email ? (extractEmailDomain(business.owner.email) || "").toLowerCase() : "";
  const effectiveDomain = fromDb || fallback;

  if (!effectiveDomain) {
    return NextResponse.json({ error: "Could not resolve business domain" }, { status: 400 });
  }

  // Derive a *clean* display cue: "health.gov.au" -> "health"
  const display = effectiveDomain.split(".")[0] || effectiveDomain;

  return NextResponse.json({ domain: effectiveDomain, display });
}

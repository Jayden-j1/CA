// app/api/staff/add/route.ts
//
// Purpose
// -------
// Start the "add staff" purchase flow (only when beyond any free-seat limit).
// - Enforces *server-side* email-domain policy (no vendor domains; must match business's org domain).
// - Creates a Stripe Checkout Session when payment is required.
// - Returns { requiresPayment: boolean, checkoutUrl?: string } so the client can redirect.
//
// Why these changes only?
// -----------------------
// • Your client code expects `checkoutUrl`. It was getting `url` → no redirect → no webhook write → no Billing row.
// • We also block vendor mailboxes and show a *clean* domain cue (`@health`) while validating the real domain
//   (e.g., `health.gov.au`). No change to permission flows or who can add whom.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import { extractEmailDomain, isPublicMailboxDomain } from "@/lib/email/corporate";

// Use the same secret as the rest of your Stripe server code
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2023-10-16" as any });

/** Get the "effective" org domain for a business:
 *  - Prefer Business.emailDomain if present
 *  - else fall back to the owner's email domain
 */
async function resolveBusinessEffectiveDomain(businessId: string): Promise<{ effectiveDomain: string | null; displayLabel: string | null }> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { owner: { select: { email: true } } },
  });

  if (!business) return { effectiveDomain: null, displayLabel: null };

  const domain =
    (business.emailDomain || "") ||
    (business.owner?.email ? extractEmailDomain(business.owner.email) || "" : "");

  const effectiveDomain = domain.toLowerCase() || null;

  // "health.gov.au" -> display "@health"
  const displayLabel = effectiveDomain ? effectiveDomain.split(".")[0] || null : null;

  return { effectiveDomain, displayLabel };
}

/** Allow same-domain or subdomain, e.g.
 *   - candidate: "team.health.gov.au"
 *   - base:      "health.gov.au"  ✅ allowed
 */
function isSameOrSubdomain(candidate: string, base: string): boolean {
  if (!candidate || !base) return false;
  if (candidate === base) return true;
  return candidate.endsWith("." + base);
}

export async function POST(req: NextRequest) {
  // 1) AuthN + AuthZ
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "BUSINESS_OWNER") {
    return NextResponse.json({ error: "Only business owners can add staff" }, { status: 403 });
  }

  try {
    // Expected input (unchanged)
    const { pricePerStaff, name, email, password, isAdmin, businessId } = await req.json();

    // 2) Basic guards
    if (!businessId || businessId !== session.user.businessId) {
      return NextResponse.json({ error: "Invalid business context" }, { status: 400 });
    }
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // 3) Resolve effective org domain + vendor blocking
    const { effectiveDomain, displayLabel } = await resolveBusinessEffectiveDomain(businessId);

    if (!effectiveDomain) {
      return NextResponse.json({ error: "Business domain is not configured yet" }, { status: 400 });
    }

    const candidateDomain = extractEmailDomain(email);
    if (!candidateDomain) {
      return NextResponse.json({ error: "Invalid staff email address" }, { status: 400 });
    }

    // Block public/vendor mailboxes (gmail/outlook/yahoo/etc.)
    if (isPublicMailboxDomain(candidateDomain)) {
      return NextResponse.json(
        { error: `Vendor mailboxes are not allowed. Please use your company email (e.g., @${displayLabel || effectiveDomain}).` },
        { status: 400 }
      );
    }

    // Must match same domain or subdomain of the business domain
    if (!isSameOrSubdomain(candidateDomain, effectiveDomain)) {
      return NextResponse.json(
        { error: `Only emails from @${displayLabel || effectiveDomain} (or its subdomains) are allowed for staff.` },
        { status: 400 }
      );
    }

    // 4) Seat limit check (unchanged)
    const staffCount = await prisma.user.count({
      where: { businessId, role: "USER" },
    });

    const freeStaffLimit = 1; // keep your existing rule

    // 5) If under the free limit, no payment required (behavior unchanged)
    if (staffCount < freeStaffLimit) {
      return NextResponse.json({ requiresPayment: false });
    }

    // 6) Payment required → create Stripe Checkout
    const unitAmountCents = Math.round(Number(pricePerStaff) * 100);
    if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0) {
      return NextResponse.json({ error: "Invalid staff seat price" }, { status: 400 });
    }

    const successUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?success=true`;
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?canceled=true`;

    const stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: { name: "Add Staff Member (Staff Seat)" },
            unit_amount: unitAmountCents,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // 🔑 Key metadata used by your webhook to insert a Payment row
      metadata: {
        purpose: "STAFF_SEAT",
        description: "Staff Seat",
        userId: session.user.id, // payer (owner/admin)
      },
    });

    // ✅ Return the property name your client expects
    return NextResponse.json({ requiresPayment: true, checkoutUrl: stripeSession.url });
  } catch (error) {
    console.error("[API] /api/staff/add error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

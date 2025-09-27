// app/api/checkout/create-session/route.ts
//
// Purpose:
// - Creates a Stripe Checkout session for purchasing PACKAGE products.
// - Uses env-based pricing (STRIPE_INDIVIDUAL_PRICE, STRIPE_BUSINESS_PRICE).
// - Always validates session and packageType.
//
// Fix:
// - Ensure this file is `.ts`, not `.js` (so type annotations work).
// - Removed error-prone JS/TS mismatch.
//
// Security:
// - Never trust client for price — we always set price from env on the server.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    // 1. Ensure user is logged in
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse client body
    const { packageType } = await req.json();

    if (!["individual", "business"].includes(packageType)) {
      return NextResponse.json({ error: "Invalid package type" }, { status: 400 });
    }

    // 3. Load prices from env vars (in cents)
    const price =
      packageType === "individual"
        ? Number(process.env.STRIPE_INDIVIDUAL_PRICE)
        : Number(process.env.STRIPE_BUSINESS_PRICE);

    if (!price || isNaN(price)) {
      throw new Error("Missing Stripe env vars for pricing");
    }

    // 4. Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: {
              name: `${packageType === "individual" ? "Individual" : "Business"} Package`,
            },
            unit_amount: price, // always from env
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/upgrade?canceled=true`,
      metadata: {
        userId: session.user.id,
        purpose: "PACKAGE",
        description: `${packageType} package`,
      },
    });

    // 5. Return session URL
    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[API] create-session error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

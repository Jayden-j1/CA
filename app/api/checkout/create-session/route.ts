// app/api/checkout/create-session/route.ts
//
// Purpose:
// - Creates Stripe Checkout Sessions securely.
// - Uses server-side env vars for actual amounts (never trust client input).
// - Supports 3 package types: "individual", "business", "staff_seat".
//
// Security:
// - Price amounts are never passed from the client. They are resolved here.
// - Staff seats are priced separately and validated here.
//
// Redirects:
// - On success: back to /services or /dashboard/upgrade with ?success=true
// - On cancel:  back with ?canceled=true
// - On error:   back with ?error=message

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

// ✅ Allowed package types
type PackageType = "individual" | "business" | "staff_seat";

export async function POST(req: Request) {
  try {
    const { packageType }: { packageType: PackageType } = await req.json();

    // 1. Resolve Stripe price (in cents) and metadata
    let amount: number;
    let productName: string;

    switch (packageType) {
      case "individual":
        amount = parseInt(process.env.STRIPE_INDIVIDUAL_PRICE || "8000");
        productName = "Individual Package";
        break;
      case "business":
        amount = parseInt(process.env.STRIPE_BUSINESS_PRICE || "20000");
        productName = "Business Package";
        break;
      case "staff_seat":
        amount = parseInt(process.env.STRIPE_STAFF_SEAT_PRICE || "5000");
        productName = "Staff Seat";
        break;
      default:
        return NextResponse.json(
          { error: "Invalid package type" },
          { status: 400 }
        );
    }

    // 2. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: {
              name: productName,
            },
            unit_amount: amount, // ✅ always in cents
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/services?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/services?canceled=true`,
      metadata: {
        purpose: packageType === "staff_seat" ? "STAFF_SEAT" : "PACKAGE",
        packageType,
        // In real flow, attach userId from session if logged in
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[Checkout] Error creating session:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create session" },
      { status: 500 }
    );
  }
}

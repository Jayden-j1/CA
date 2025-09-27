// app/api/checkout/create-session/route.ts
//
// Purpose:
// - Securely creates Stripe Checkout Sessions from the server.
// - Supports multiple package types: "individual", "business", "staff_seat".
// - Prices are pulled from server-side env vars (cents).
//
// Security:
// - Never trust client-sent price values.
// - Always resolve amounts on the server using STRIPE_* env vars.
//
// Flow:
// 1. Client sends { packageType }.
// 2. Server resolves correct price + description.
// 3. Stripe Checkout Session created.
// 4. Returns Checkout URL to client.
// 5. Client redirects user to Stripe-hosted payment page.

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

// ✅ Allowed package types
type PackageType = "individual" | "business" | "staff_seat";

export async function POST(req: Request) {
  try {
    // 1. Parse packageType from client request
    const { packageType }: { packageType: PackageType } = await req.json();

    // 2. Resolve price + product info from env vars (always in cents)
    let amount: number;
    let productName: string;

    switch (packageType) {
      case "individual":
        amount = parseInt(process.env.STRIPE_INDIVIDUAL_PRICE || "8000", 10);
        productName = "Individual Package";
        break;
      case "business":
        amount = parseInt(process.env.STRIPE_BUSINESS_PRICE || "20000", 10);
        productName = "Business Package";
        break;
      case "staff_seat":
        amount = parseInt(process.env.STRIPE_STAFF_SEAT_PRICE || "5000", 10);
        productName = "Staff Seat";
        break;
      default:
        return NextResponse.json(
          { error: "Invalid package type" },
          { status: 400 }
        );
    }

    // 3. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"], // ✅ supports test card 4242...
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: { name: productName },
            unit_amount: amount, // cents
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/services?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/services?canceled=true`,
      metadata: {
        purpose: packageType === "staff_seat" ? "STAFF_SEAT" : "PACKAGE",
        packageType,
      },
    });

    // 4. Respond with Checkout URL
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[Checkout] Error creating session:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create session" },
      { status: 500 }
    );
  }
}

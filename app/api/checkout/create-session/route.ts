// app/api/checkout/create-session/route.ts
//
// Purpose:
// - Securely creates Stripe Checkout Sessions from the server.
// - Supports multiple package types: "individual", "business", "staff_seat".
// - Prices are pulled from server-side env vars (cents).
//
// Updates in this version:
// - If the user is logged in, success/cancel URLs now target internal dashboard routes:
//     success: /dashboard?success=true
//     cancel:  /dashboard/upgrade?canceled=true
//   (This fixes the issue where successful payments returned to the public /services page.)
// - Adds `metadata.userId` (when logged in) so the webhook can attach the payment to the right user.
// - Adds `metadata.description` to create clear human-readable payment descriptions in DB.
//
// Security:
// - Never trust client price; always resolve on server from STRIPE_* env vars.

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type PackageType = "individual" | "business" | "staff_seat";

export async function POST(req: Request) {
  try {
    const { packageType }: { packageType: PackageType } = await req.json();

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
        return NextResponse.json({ error: "Invalid package type" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const isLoggedIn = Boolean(session?.user?.id);
    const userId = session?.user?.id || null;

    const successUrl =
      packageType === "staff_seat"
        ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?success=true`
        : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`;

    const cancelUrl =
      packageType === "staff_seat"
        ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/staff?canceled=true`
        : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade?canceled=true`;

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: { name: productName },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        purpose: packageType === "staff_seat" ? "STAFF_SEAT" : "PACKAGE",
        packageType,
        description: productName,
        ...(isLoggedIn && userId ? { userId } : {}),
      },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (err: any) {
    console.error("[Checkout] Error creating session:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create session" },
      { status: 500 }
    );
  }
}










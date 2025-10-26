// app/api/checkout/create-session/route.ts
//
// Purpose
// -------
// Create Stripe Checkout Sessions securely.
// - Uses server-side env amounts (never trust client)
// - Writes metadata for robust webhook handling
// - Returns dashboard success/cancel URLs so we don't bounce back to /services
//
// 🔧 Robustness addition:
// - Provide `customer_email` when a session user exists so the webhook can
//   always attribute the payment via email fallback (if metadata.userId is absent).

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
    const userId = session?.user?.id || null;
    const userEmail = session?.user?.email || undefined;

    // Return to the correct area of the dashboard after payment/cancel.
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

      // ✅ Ensures webhook can attribute payer even if userId metadata is missing
      ...(userEmail ? { customer_email: userEmail } : {}),

      // Metadata used by webhook
      metadata: {
        purpose: packageType === "staff_seat" ? "STAFF_SEAT" : "PACKAGE",
        packageType,
        description: productName,
        ...(userId ? { userId } : {}),
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

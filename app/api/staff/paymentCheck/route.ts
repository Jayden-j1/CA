import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

//  Initialize Stripe once, safely
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  // 1️ Ensure user is logged in
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2️ Restrict endpoint to business owners
  if (session.user.role !== "BUSINESS_OWNER") {
    return NextResponse.json(
      { error: "Only business owners can add staff" },
      { status: 403 }
    );
  }

  try {
    const { pricePerStaff } = await req.json();

    // 3️ Count current staff for this business
    const businessId = session.user.businessId!;
    const staffCount = await prisma.user.count({
      where: { businessId, role: "USER" },
    });

    // 4️ First staff member free, afterwards → require payment
    const freeStaffLimit = 1;
    if (staffCount < freeStaffLimit) {
      return NextResponse.json({ requiresPayment: false });
    }

    // 5️ Create Stripe Checkout for adding a staff member
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: { name: "Add Staff Member" },
            unit_amount: Math.round(pricePerStaff * 100), // AUD → cents
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/dashboard/staff?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/staff?canceled=true`,
      metadata: { userId: session.user.id, description: "Add Staff Member" },
    });

    return NextResponse.json({ requiresPayment: true, url: stripeSession.url });
  } catch (error) {
    console.error("Payment check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

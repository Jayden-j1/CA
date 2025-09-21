import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2022-11-15" });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "BUSINESS_OWNER") {
    return NextResponse.json({ error: "Only business owners can add staff" }, { status: 403 });
  }

  try {
    const { pricePerStaff } = await req.json();

    // ✅ Get business and staff count
    const businessId = session.user.businessId!;
    const staffCount = await prisma.user.count({
      where: { businessId, role: "USER" },
    });

    const freeStaffLimit = 1; // Free staff allowance
    if (staffCount < freeStaffLimit) {
      return NextResponse.json({ requiresPayment: false });
    }

    // ✅ Payment required: create Stripe checkout session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "aud",
          product_data: { name: "Add Staff Member" },
          unit_amount: Math.round(pricePerStaff * 100),
        },
        quantity: 1,
      }],
      success_url: `${process.env.NEXTAUTH_URL}/dashboard/staff?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/staff?canceled=true`,
      metadata: { userId: session.user.id },
    });

    return NextResponse.json({ requiresPayment: true, url: stripeSession.url });
  } catch (error) {
    console.error("Payment check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

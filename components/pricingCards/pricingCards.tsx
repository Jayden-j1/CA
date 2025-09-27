// components/pricingCards/pricingCards.tsx
//
// Purpose:
// - Show pricing packages (Individual / Business).
// - If logged in → checkout buttons.
// - If guest → redirect to signup first.
// - Prices now come from NEXT_PUBLIC_* env vars (no hardcoding).
//
// Future-proof:
// - Added Staff Seat package (hidden by default on Services page if not needed).
//   Could be shown later or reused inside dashboard staff management.

"use client";

import React from "react";
import { useSession } from "next-auth/react";
import CheckoutButton from "@/components/payments/CheckoutButton";

interface PricingCardProps {
  name: string;
  price: string;
  services: string[];
  packageType: "individual" | "business" | "staff_seat";
}

const PricingCardSection: React.FC = () => {
  const { data: session } = useSession();

  // ✅ Read prices from env vars (client-side safe)
  const INDIVIDUAL_PRICE = process.env.NEXT_PUBLIC_INDIVIDUAL_PRICE || "50";
  const BUSINESS_PRICE = process.env.NEXT_PUBLIC_BUSINESS_PRICE || "150";
  const STAFF_SEAT_PRICE = process.env.NEXT_PUBLIC_STAFF_SEAT_PRICE || "20";

  const pricingCards: PricingCardProps[] = [
    {
      name: "Individual Package",
      price: `$${INDIVIDUAL_PRICE}.00`,
      packageType: "individual",
      services: [
        "Overview of Nyanbul culture",
        "Basic terminology",
        "Cultural etiquette",
        "Local area significance",
      ],
    },
    {
      name: "Business Package",
      price: `$${BUSINESS_PRICE}.00`,
      packageType: "business",
      services: [
        "Deep dive into language",
        "Elder interviews",
        "Workshop resources",
        "Interactive content",
      ],
    },
    // 👇 Optionally show staff seat pricing here or only in dashboard
    {
      name: "Staff Seat (per user)",
      price: `$${STAFF_SEAT_PRICE}.00`,
      packageType: "staff_seat",
      services: [
        "Adds an extra staff account",
        "Access to all business resources",
        "Same dashboard + course access",
      ],
    },
  ];

  return (
    <section className="mt-40">
      <section
        id="pricing"
        className="w-full bg-gradient-to-b from-blue-700 to-blue-300 py-16 px-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {pricingCards.map(({ name, price, services, packageType }, index) => (
            <div
              key={index}
              className="flex flex-col justify-between items-center gap-6 bg-blue-700 text-white rounded-xl p-8 shadow-xl transition-transform duration-300 hover:scale-105"
            >
              <h3 className="text-2xl font-extrabold tracking-wide text-center">
                {name}
              </h3>
              <h4 className="text-xl font-bold tracking-wider">{price}</h4>

              {session?.user ? (
                <CheckoutButton
                  packageType={packageType}
                  label={`Buy ${name}`}
                  className="bg-green-500 hover:bg-green-400 text-white font-semibold rounded-full"
                />
              ) : (
                <a
                  href="/signup"
                  className="px-6 py-3 bg-green-500 text-white font-semibold rounded-full hover:bg-green-400 transition-colors duration-300"
                >
                  Sign Up First
                </a>
              )}

              <ul className="list-disc pl-5 space-y-2 text-sm font-medium">
                {services.map((service, idx) => (
                  <li key={idx}>{service}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
};

export default PricingCardSection;

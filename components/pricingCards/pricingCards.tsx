// components/pricingCards/pricingCards.tsx
//
// Purpose:
// - Show pricing packages (Individual / Business).
// - If logged in → checkout buttons.
// - If guest → redirect to signup first.
//
// Changes in this patch:
// ----------------------
// 1) Center the pricing cards nicely for 1–2 columns:
//    - Use a narrower container (max-w-5xl) and `justify-items-center` on the grid.
//    - Give each card a fixed responsive width so two cards center symmetrically.
// 2) When user is not logged-in and clicks "Sign Up First", we now send them to:
//      /signup?from=services&package=<packageType>
//    This tells the server to render the 'services' origin so the form will
//    go straight to Stripe after account creation, preserving your intended flow.

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
  // Keeping staff seat var even if the card is commented out for now
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
    // {
    //   name: "Staff Seat (per user)",
    //   price: `$${STAFF_SEAT_PRICE}.00`,
    //   packageType: "staff_seat",
    //   services: [
    //     "Adds an extra staff account",
    //     "Access to all business resources",
    //     "Same dashboard + course access",
    //   ],
    // },
  ];

  return (
    <section className="mt-40">
      <section
        id="pricing"
        className="w-full bg-linear-to-b from-blue-700 to-blue-300 py-16 px-4"
      >
        {/* 
          Layout notes:
          - max-w-5xl keeps two cards visually centered on large screens.
          - justify-items-center centers the card columns themselves.
          - gap-8 for breathing room.
        */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto justify-items-center">
          {pricingCards.map(({ name, price, services, packageType }, index) => (
            <div
              key={index}
              className="w-full sm:w-[380px] md:w-[420px] flex flex-col justify-between items-center gap-6 bg-blue-700 text-white rounded-xl p-8 shadow-xl transition-transform duration-300 hover:scale-105"
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
                // 👇 Pass origin + package to signup so the flow returns to Stripe after account creation
                <a
                  href={`/signup?from=services&package=${encodeURIComponent(packageType)}`}
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

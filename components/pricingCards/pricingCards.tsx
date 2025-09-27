// components/pricingCards/pricingCards.tsx
//
// Purpose:
// - Show pricing packages (Individual / Business).
// - Pulls prices dynamically from NEXT_PUBLIC_* env vars so there’s a single
//   source of truth for client-side display.
// - If user is logged in → show <CheckoutButton /> for direct checkout.
// - If not logged in → prompt them to sign up.
//
// Benefits:
// - No more hardcoding prices in multiple places.
// - If you update .env pricing values → all pages update automatically.
//
// Security:
// - Prices in env here are *only for display*.
// - Actual charged amounts come from server-side /api/checkout/create-session
//   which uses STRIPE_*_PRICE in cents (so client cannot override).

"use client";

import React from "react";
import { useSession } from "next-auth/react";
import CheckoutButton from "@/components/payments/CheckoutButton";

// ------------------------------
// Types
// ------------------------------
interface PricingCardProps {
  name: string;       // Package name
  price: string;      // Display price (comes from env now)
  services: string[]; // Included features
}

// ------------------------------
// Component
// ------------------------------
const PricingCardSection: React.FC = () => {
  const { data: session } = useSession();

  // ✅ Read display values from env
  const individualPrice = process.env.NEXT_PUBLIC_INDIVIDUAL_PRICE || "50";
  const businessPrice = process.env.NEXT_PUBLIC_BUSINESS_PRICE || "150";

  // ✅ Static package descriptions, prices injected from env
  const pricingCards: PricingCardProps[] = [
    {
      name: "Individual Package",
      price: `$${individualPrice}.00`,
      services: [
        "Overview of Nyanbul culture",
        "Basic terminology",
        "Cultural etiquette",
        "Local area significance",
      ],
    },
    {
      name: "Business Package",
      price: `$${businessPrice}.00`,
      services: [
        "Deep dive into language",
        "Elder interviews",
        "Workshop resources",
        "Interactive content",
      ],
    },
  ];

  return (
    <section className="mt-40">
      <section
        id="pricing"
        className="w-full bg-gradient-to-b from-blue-700 to-blue-300 py-16 px-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {pricingCards.map(({ name, price, services }, index) => {
            const packageType =
              name.includes("Individual") ? "individual" : "business";

            return (
              <div
                key={index}
                className="flex flex-col justify-between items-center gap-6 bg-blue-700 text-white rounded-xl p-8 shadow-xl transition-transform duration-300 hover:scale-105"
              >
                {/* Package Title */}
                <h3 className="text-2xl font-extrabold tracking-wide text-center">
                  {name}
                </h3>

                {/* Package Price (from env) */}
                <h4 className="text-xl font-bold tracking-wider">{price}</h4>

                {/* ✅ If logged in → show checkout, else → signup */}
                {session?.user ? (
                  <CheckoutButton
                    packageType={packageType as "individual" | "business"}
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

                {/* Features List */}
                <ul className="list-disc pl-5 space-y-2 text-sm font-medium">
                  {services.map((service, idx) => (
                    <li key={idx}>{service}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
};

export default PricingCardSection;

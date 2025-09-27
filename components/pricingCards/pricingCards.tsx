// components/pricingCards/pricingCards.tsx
//
// Purpose:
// - Show pricing packages (Individual / Business).
// - If user is logged in → show <CheckoutButton /> for direct checkout.
// - If user is not logged in → show "Sign Up First" button.
//
// Notes:
// - Checkout goes to /api/checkout/create-session which sets metadata purpose=PACKAGE
//   and redirects to Stripe-hosted checkout.
// - On return, /services shows success/canceled toasts.

"use client";

import React from "react";
import { useSession } from "next-auth/react";
import CheckoutButton from "@/components/payments/CheckoutButton";

// ------------------------------
// Types
// ------------------------------
interface PricingCardProps {
  name: string;       // Package name (e.g., "Individual Package")
  price: string;      // Display price (e.g., "$50.00")
  services: string[]; // List of included features
}

// ------------------------------
// Component
// ------------------------------
const PricingCardSection: React.FC = () => {
  const { data: session } = useSession();

  // Static packages (textual)
  const pricingCards: PricingCardProps[] = [
    {
      name: "Individual Package",
      price: "$50.00",
      services: [
        "Overview of Nyanbul culture",
        "Basic terminology",
        "Cultural etiquette",
        "Local area significance",
      ],
    },
    {
      name: "Business Package",
      price: "$150.00",
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

                {/* Package Price */}
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

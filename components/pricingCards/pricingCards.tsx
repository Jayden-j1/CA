// components/pricingCards/pricingCards.tsx
//
// Purpose
// -------
// Show pricing packages (Individual / Business).
// • If a user is logged in → render a "Buy" button that goes straight to secure checkout.
// • If a user is a guest → send them to /signup?from=services&package=<type>
//   so they create an account first, then the form will route them to checkout.
//
// This revision (surgical change):
// --------------------------------
// 🔹 Only updates the background of the pricing section:
//     - Replaces Tailwind gradient
//       `bg-gradient-to-b from-blue-700 to-blue-300`
//       with a background image using `backgroundImage`.
//     - Adds `bg-cover bg-center` so the image scales cleanly.
// 🔹 All logic, layout, and CTA behavior remain IDENTICAL.

"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import CheckoutButton from "@/components/payments/CheckoutButton";

// Shape for each card
interface PricingCardProps {
  name: string;
  price: string;
  services: string[];
  packageType: "individual" | "business" | "staff_seat";
}

const PricingCardSection: React.FC = () => {
  const { data: session } = useSession();

  // Read display prices from public env vars (safe for client)
  const INDIVIDUAL_PRICE = process.env.NEXT_PUBLIC_INDIVIDUAL_PRICE || "50";
  const BUSINESS_PRICE = process.env.NEXT_PUBLIC_BUSINESS_PRICE || "150";
  // Keeping staff seat var even if the card is commented for now
  const STAFF_SEAT_PRICE = process.env.NEXT_PUBLIC_STAFF_SEAT_PRICE || "20";

  // Source of truth for card content
  const pricingCards: PricingCardProps[] = [
    {
      name: "Individual Package",
      price: `$${INDIVIDUAL_PRICE}.00 / Year`,
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
      price: `$${BUSINESS_PRICE}.00 / Year`,
      packageType: "business",
      services: [
        "All Individual features",
        "Org owner/admin privileges",
        "Add staff seats (paid)",
        "Billing dashboard",
      ],
    },
  ];

  return (
    <section className="mt-40">
      <section
        id="pricing"
        aria-label="Pricing"
        // 🔄 Background change:
        // - Remove gradient classes
        // - Use an image as the background instead.
        //   You can swap "/images/pricing-bg.png" for any image you prefer.
        className="w-full py-16 px-4 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/background image.png')" }}
      >
        {/* 
          Layout notes:
          - max-w-5xl keeps two cards visually centered on large screens.
          - justify-items-center centers the card columns themselves.
          - gap-8 for breathing room.
          (Unchanged from previous version.)
        */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto justify-items-center">
          {pricingCards.map(({ name, price, services, packageType }, index) => {
            const signupHref = `/signup?from=services&package=${encodeURIComponent(
              packageType
            )}`;

            return (
              <article
                key={index}
                className="w-full sm:w-[380px] md:w-[420px] flex flex-col justify-between items-center gap-6 bg-blue-700 text-white rounded-xl p-8 shadow-xl transition-transform duration-300 hover:scale-105"
                data-card
                data-package={packageType}
                aria-label={`${name} card`}
              >
                {/* Title + Price */}
                <div className="w-full text-center">
                  <h3 className="text-2xl font-extrabold tracking-wide">
                    {name}
                  </h3>
                  <p className="mt-2 text-xl font-bold tracking-wider">
                    {price}
                  </p>
                </div>

                {/* CTA:
                    - Logged-in → CheckoutButton (unchanged behavior).
                    - Guest     → Link to /signup?from=services&package=<type>
                */}
                <div className="w-full">
                  {session?.user ? (
                    <CheckoutButton
                      packageType={packageType}
                      label={`Buy ${name}`}
                      className="w-full bg-green-500 hover:bg-green-400 text-white font-semibold rounded-full"
                      aria-label={`Proceed to checkout for ${name}`}
                    />
                  ) : (
                    <Link
                      href={signupHref}
                      prefetch
                      // Clear CTA styling; matches your brand style
                      className="inline-flex w-full items-center justify-center px-6 py-3 bg-green-500 text-white font-semibold rounded-full hover:bg-green-400 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/80"
                      aria-label={`Sign up to purchase ${name}`}
                      data-cta="signup-first"
                      data-package={packageType}
                    >
                      Sign Up First
                    </Link>
                  )}
                </div>

                {/* Feature list */}
                <ul className="list-disc pl-5 space-y-2 text-sm font-medium self-start">
                  {services.map((service, idx) => (
                    <li key={idx}>{service}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
};

export default PricingCardSection;









// // components/pricingCards/pricingCards.tsx
// //
// // Purpose
// // -------
// // Show pricing packages (Individual / Business).
// // • If a user is logged in → render a "Buy" button that goes straight to secure checkout.
// // • If a user is a guest → send them to /signup?from=services&package=<type>
// //   so they create an account first, then the form will route them to checkout.
// //
// // What this update changes (safely):
// // ----------------------------------
// // 1) **Explicit, accessible links** for guests using Next.js <Link> to
// //    `/signup?from=services&package=...` (no brittle delegation).
// // 2) Fix Tailwind typo `bg-linear-to-b` → `bg-gradient-to-b`.
// // 3) Keep your centering and responsive layout; add minor a11y/data attributes.
// // 4) Preserve existing behavior for logged-in users: still uses <CheckoutButton />.
// //
// // Pillars
// // -------
// // ✅ Efficiency: no extra effects; SSR/CSR friendly.
// // ✅ Robustness: explicit URLs; no client-side delegation required.
// // ✅ Simplicity: one place to control CTAs.
// // ✅ Ease of mgmt: prices from env; rich comments.
// // ✅ Security: navigation only; server keeps all payment/account validation.

// "use client";

// import React from "react";
// import Link from "next/link";
// import { useSession } from "next-auth/react";
// import CheckoutButton from "@/components/payments/CheckoutButton";

// // Shape for each card
// interface PricingCardProps {
//   name: string;
//   price: string;
//   services: string[];
//   packageType: "individual" | "business" | "staff_seat";
// }

// const PricingCardSection: React.FC = () => {
//   const { data: session } = useSession();

//   // Read display prices from public env vars (safe for client)
//   const INDIVIDUAL_PRICE = process.env.NEXT_PUBLIC_INDIVIDUAL_PRICE || "50";
//   const BUSINESS_PRICE = process.env.NEXT_PUBLIC_BUSINESS_PRICE || "150";
//   // Keeping staff seat var even if the card is commented for now
//   const STAFF_SEAT_PRICE = process.env.NEXT_PUBLIC_STAFF_SEAT_PRICE || "20";

//   // Source of truth for card content
//   const pricingCards: PricingCardProps[] = [
//     {
//       name: "Individual Package",
//       price: `$${INDIVIDUAL_PRICE}.00 / Year`,
//       packageType: "individual",
//       services: [
//         "Overview of Nyanbul culture",
//         "Basic terminology",
//         "Cultural etiquette",
//         "Local area significance",
//       ],
//     },
//     {
//       name: "Business Package",
//       price: `$${BUSINESS_PRICE}.00 / Year`,
//       packageType: "business",
//       services: [
//         "All Individual features",
//         "Org owner/admin privileges",
//         "Add staff seats (paid)",
//         "Billing dashboard",
//       ],
//     },
//   ];

//   return (
//     <section className="mt-40">
//       <section
//         id="pricing"
//         // 🔧 Tailwind fix: bg-gradient-to-b (instead of the invalid bg-linear-to-b)
//         className="w-full bg-gradient-to-b from-blue-700 to-blue-300 py-16 px-4"
//         aria-label="Pricing"
//       >
//         {/* 
//           Layout notes:
//           - max-w-5xl keeps two cards visually centered on large screens.
//           - justify-items-center centers the card columns themselves.
//           - gap-8 for breathing room.
//         */}
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto justify-items-center">
//           {pricingCards.map(({ name, price, services, packageType }, index) => {
//             const signupHref = `/signup?from=services&package=${encodeURIComponent(
//               packageType
//             )}`;

//             return (
//               <article
//                 key={index}
//                 className="w-full sm:w-[380px] md:w-[420px] flex flex-col justify-between items-center gap-6 bg-blue-700 text-white rounded-xl p-8 shadow-xl transition-transform duration-300 hover:scale-105"
//                 data-card
//                 data-package={packageType}
//                 aria-label={`${name} card`}
//               >
//                 {/* Title + Price */}
//                 <div className="w-full text-center">
//                   <h3 className="text-2xl font-extrabold tracking-wide">
//                     {name}
//                   </h3>
//                   <p className="mt-2 text-xl font-bold tracking-wider">
//                     {price}
//                   </p>
//                 </div>

//                 {/* CTA:
//                     - Logged-in → CheckoutButton (unchanged behavior).
//                     - Guest     → Link to /signup?from=services&package=<type>
//                 */}
//                 <div className="w-full">
//                   {session?.user ? (
//                     <CheckoutButton
//                       packageType={packageType}
//                       label={`Buy ${name}`}
//                       className="w-full bg-green-500 hover:bg-green-400 text-white font-semibold rounded-full"
//                       aria-label={`Proceed to checkout for ${name}`}
//                     />
//                   ) : (
//                     <Link
//                       href={signupHref}
//                       prefetch
//                       // Clear CTA styling; matches your brand style
//                       className="inline-flex w-full items-center justify-center px-6 py-3 bg-green-500 text-white font-semibold rounded-full hover:bg-green-400 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/80"
//                       aria-label={`Sign up to purchase ${name}`}
//                       data-cta="signup-first"
//                       data-package={packageType}
//                     >
//                       Sign Up First
//                     </Link>
//                   )}
//                 </div>

//                 {/* Feature list */}
//                 <ul className="list-disc pl-5 space-y-2 text-sm font-medium self-start">
//                   {services.map((service, idx) => (
//                     <li key={idx}>{service}</li>
//                   ))}
//                 </ul>
//               </article>
//             );
//           })}
//         </div>
//       </section>
//     </section>
//   );
// };

// export default PricingCardSection;

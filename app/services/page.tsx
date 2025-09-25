// app/services/page.tsx
//
// Purpose:
// - Public-facing services page.
// - Shows pricing section with smart buttons:
//   - Logged out → Sign Up First
//   - Logged in → Buy Now (direct checkout)

"use client";

import TopofPageContent from "@/components/topPage/topOfPageStyle";
import PricingCardSection from "@/components/pricingCards/pricingCards";
import { MouseEvent } from "react";

export default function ServicesPage() {
  // Smooth scroll to pricing section
  const handleScrollToPricing = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const pricingSection = document.querySelector<HTMLDivElement>("#pricing");
    pricingSection?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="m-0 p-0">
      <TopofPageContent
        HeadingOneTitle="Services"
        paragraphContent="We offer cultural awareness course packages focused on the Nyanbul people of the Bundjalung nation from Ballina/Bullinah."
        linkOne="Prices Below"
        href="#pricing"
        onClick={handleScrollToPricing}
      />

      {/* ✅ Smart Pricing Cards */}
      <PricingCardSection />
    </main>
  );
}









// 'use client';
// import TopofPageContent from '../../components/topPage/topOfPageStyle';
// import PricingCardSection from '@/components/pricingCards/pricingCards';
// import { MouseEvent } from 'react';

// export default function ServicesPage() {
//   const handleScrollToPricing = (e: MouseEvent<HTMLAnchorElement>) => {
//     e.preventDefault();
//     const pricingSection = document.querySelector<HTMLDivElement>('#pricing');
//     pricingSection?.scrollIntoView({ behavior: 'smooth' });
//   };

//   return (
//     <main className="m-0 p-0">
//       <TopofPageContent
//         HeadingOneTitle="Services"
//         paragraphContent="We offer cultural awareness course packages focused on the Nyanbul people of the Bundjalung nation from Ballina/Bullinah."
//         linkOne="Prices Below"
//         href="#pricing"
//         onClick={handleScrollToPricing}
//       />

//       {/* Pricing Cards */}
//       <PricingCardSection />
//     </main>
//   );
// }



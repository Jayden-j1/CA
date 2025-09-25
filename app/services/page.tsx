// app/services/page.tsx
//
// Purpose:
// - Public-facing services page with pricing cards.
// - Adds toast feedback when users return from Stripe checkout.
//   ?success=true → green success toast
//   ?canceled=true → red error toast
//
// Notes:
// - Uses <PricingCardSection /> (smart cards: show Buy Now or Sign Up).
// - Ensures a smooth flow for both guests and logged-in users.

"use client";

import TopofPageContent from "@/components/topPage/topOfPageStyle";
import PricingCardSection from "@/components/pricingCards/pricingCards";
import { MouseEvent, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

export default function ServicesPage() {
  const searchParams = useSearchParams();

  // ✅ Handle Stripe redirect success/cancel
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success) {
      toast.success("🎉 Payment successful! You now have access.", {
        duration: 6000,
      });
      // ✅ Clean query params so it doesn’t repeat on refresh
      window.history.replaceState(null, "", window.location.pathname);
    }

    if (canceled) {
      toast.error("❌ Payment canceled. No changes made.", {
        duration: 6000,
      });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams]);

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

      {/* ✅ Smart Pricing Cards with checkout buttons */}
      <PricingCardSection />
    </main>
  );
}

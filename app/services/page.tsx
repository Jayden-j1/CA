// app/services/page.tsx
//
// Updated: wrapped useSearchParams logic in <Suspense> boundary
// to fix Vercel build error.

"use client";

import TopofPageContent from "@/components/topPage/topOfPageStyle";
import PricingCardSection from "@/components/pricingCards/pricingCards";
import { MouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import SearchParamsWrapper from "@/components/utils/searchParamsWrapper";

function ServicesContent() {
  const searchParams = useSearchParams();

  // ✅ Stripe success/cancel handling
  if (typeof window !== "undefined") {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success) {
      toast.success("🎉 Payment successful! You now have access.", {
        duration: 6000,
      });
      window.history.replaceState(null, "", window.location.pathname);
    }

    if (canceled) {
      toast.error("❌ Payment canceled. No changes made.", {
        duration: 6000,
      });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

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

export default function ServicesPage() {
  return (
    <SearchParamsWrapper>
      <ServicesContent />
    </SearchParamsWrapper>
  );
}

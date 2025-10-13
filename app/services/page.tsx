// app/services/page.tsx
//
// ✅ Update: null-safe `useSearchParams()` to prevent build errors.
// All behavior and UX remain identical.

"use client";

import TopofPageContent from "@/components/topPage/topOfPageStyle";
import PricingCardSection from "@/components/pricingCards/pricingCards";
import { MouseEvent, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import SearchParamsWrapper from "@/components/utils/searchParamsWrapper";

function ServicesToastHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // ✅ Null-safe reads
    const success = (searchParams?.get("success") ?? "") === "true";
    const canceled = (searchParams?.get("canceled") ?? "") === "true";
    const error = searchParams?.get("error") ?? "";

    if (success) {
      toast.success("🎉 Payment successful! You now have access.", {
        duration: 3000,
      });
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (canceled) {
      toast.error("❌ Payment canceled. No changes made.", { duration: 3000 });
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (error) {
      toast.error(`⚠️ Payment failed: ${error}`, { duration: 8000 });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams]);

  return null;
}

function ServicesContent() {
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

      <PricingCardSection />
    </main>
  );
}

export default function ServicesPage() {
  return (
    <SearchParamsWrapper>
      {/* Toast handler for Stripe redirects */}
      <ServicesToastHandler />
      <ServicesContent />
    </SearchParamsWrapper>
  );
}

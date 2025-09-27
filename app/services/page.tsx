// app/services/page.tsx
//
// Updated: 
// - Added explicit error toast handling for Stripe failures (from query params).
// - Moved amounts to env in CheckoutButton (not here, but passed automatically).
// - Wrapped in <SearchParamsWrapper> so useSearchParams works with Suspense.

"use client";

import TopofPageContent from "@/components/topPage/topOfPageStyle";
import PricingCardSection from "@/components/pricingCards/pricingCards";
import { MouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import SearchParamsWrapper from "@/components/utils/searchParamsWrapper";

function ServicesContent() {
  const searchParams = useSearchParams();

  // ✅ Handle success, cancel, and error query params
  if (typeof window !== "undefined") {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    const error = searchParams.get("error"); // NEW: explicit error support

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

    if (error) {
      toast.error(`⚠️ Payment failed: ${error}`, { duration: 8000 });
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

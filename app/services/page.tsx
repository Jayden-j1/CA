// app/services/page.tsx
//
// Purpose:
// - Public-facing Services page.
// - Shows pricing packages + handles Stripe checkout redirects.
// - Uses NEXT_PUBLIC_* env vars (via CheckoutButton / PricingCardSection).
//
// Updates:
// - Added explicit error toast handling (⚠️ Payment failed).
// - Ensures consistent UX between Services and Upgrade pages.
// - Wrapped in <SearchParamsWrapper> to safely use useSearchParams().
//
// Security:
// - Prices displayed are from NEXT_PUBLIC_* env vars.
// - Real billing amounts enforced server-side in /api/checkout/create-session
//   using STRIPE_*_PRICE env vars (cents).

"use client";

import TopofPageContent from "@/components/topPage/topOfPageStyle";
import PricingCardSection from "@/components/pricingCards/pricingCards";
import { MouseEvent, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import SearchParamsWrapper from "@/components/utils/searchParamsWrapper";

// ------------------------------
// Query Param Toast Handler
// ------------------------------
// Handles ?success, ?canceled, ?error query params from Stripe redirect
function ServicesToastHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    const error = searchParams.get("error"); // ✅ NEW

    if (success) {
      toast.success("🎉 Payment successful! You now have access.", {
        duration: 6000,
      });
      // Clean URL to prevent repeated toast on refresh
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
  }, [searchParams]);

  return null;
}

// ------------------------------
// Main Services Content
// ------------------------------
function ServicesContent() {
  // Scrolls to pricing section when clicking "Prices Below"
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

      {/* Pricing section with env-driven prices */}
      <PricingCardSection />
    </main>
  );
}

// ------------------------------
// Export Page Component
// ------------------------------
export default function ServicesPage() {
  return (
    <SearchParamsWrapper>
      {/* ✅ Toast handler runs globally on this page */}
      <ServicesToastHandler />
      <ServicesContent />
    </SearchParamsWrapper>
  );
}

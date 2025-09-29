// app/services/page.tsx
//
// Purpose:
// - Public-facing Services page.
// - Shows pricing packages + handles Stripe checkout redirects.
// - Uses NEXT_PUBLIC_* env vars (via CheckoutButton / PricingCardSection).
//
// Updates (minor):
// - No functional change needed for the "signup → pay → dashboard" flow,
//   because CheckoutButton only renders for logged-in users.
// - The backend success_url now goes to /dashboard instead of /services.
// - Defensive guards: none needed; keeping existing toast handling.
//
// Security:
// - Displayed prices from NEXT_PUBLIC_* env vars.
// - Real charges enforced server-side with STRIPE_*_PRICE in /api/checkout/create-session.

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
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    const error = searchParams.get("error");

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

      {/* Pricing section with env-driven prices (only logged-in users see Checkout button) */}
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

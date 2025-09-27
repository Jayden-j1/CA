// app/dashboard/upgrade/page.tsx
//
// Purpose:
// - Shown to logged-in users who have NOT purchased a package.
// - Encourages upgrading to unlock Map + Course Content.
// - Prices pulled from NEXT_PUBLIC_* env vars (consistent with services page).
//
// Features:
// - Uses reusable <CheckoutButton /> for Stripe checkout.
// - Displays success/error toasts based on Stripe redirect.
// - Handles ?success, ?canceled, and ?error query params via <SearchParamsWrapper>.
// - Automatically updates if you change values in your .env.
//
// Security:
// - Prices shown here are for display only.
// - Actual charges always come from STRIPE_*_PRICE on the server side.

"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import CheckoutButton from "@/components/payments/CheckoutButton";
import SearchParamsWrapper from "@/components/utils/searchParamsWrapper";

// ------------------------------
// Query Param → Toast handler
// ------------------------------
// Listens for `?success`, `?canceled`, or `?error` after Stripe checkout redirect.
// Wrapped in <SearchParamsWrapper> to safely use useSearchParams().
function UpgradeToastHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    const error = searchParams.get("error");

    if (success) {
      toast.success("🎉 Payment successful! You now have full access.", {
        duration: 6000,
      });
      // ✅ Clean query params to avoid repeated toasts on refresh
      window.history.replaceState(null, "", window.location.pathname);
    }

    if (canceled) {
      toast.error("❌ Payment canceled. No changes were made.", {
        duration: 6000,
      });
      window.history.replaceState(null, "", window.location.pathname);
    }

    if (error) {
      toast.error(`⚠️ Payment failed: ${error}`, { duration: 8000 });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams]);

  return null; // UI-less component, only handles side effects
}

// ------------------------------
// Main Upgrade Page
// ------------------------------
export default function UpgradePage() {
  // ✅ Read display prices from env
  const individualPrice = process.env.NEXT_PUBLIC_INDIVIDUAL_PRICE || "50";
  const businessPrice = process.env.NEXT_PUBLIC_BUSINESS_PRICE || "150";

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      {/* Toast handler wrapped in suspense-safe boundary */}
      <SearchParamsWrapper>
        <UpgradeToastHandler />
      </SearchParamsWrapper>

      {/* Heading */}
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
        Upgrade Required
      </h1>

      {/* Subtext */}
      <p className="text-white text-lg sm:text-xl mb-6 text-center max-w-xl">
        🚀 Unlock the Interactive Map and Course Content by purchasing a package.
      </p>

      {/* Package Buttons */}
      <div className="flex flex-col sm:flex-row gap-6">
        <CheckoutButton
          packageType="individual"
          label={`Buy Individual Package ($${individualPrice})`}
          className="bg-green-600 hover:bg-green-500 text-white"
        />
        <CheckoutButton
          packageType="business"
          label={`Buy Business Package ($${businessPrice})`}
          className="bg-blue-600 hover:bg-blue-500 text-white"
        />
      </div>
    </section>
  );
}

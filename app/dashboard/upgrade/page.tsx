// app/dashboard/upgrade/page.tsx
//
// Purpose:
// - Shown to logged-in users who have NOT purchased a package.
// - Encourages upgrading to unlock Map + Course Content.
// - Uses reusable <CheckoutButton /> for Stripe checkout.
// - Displays success/error toasts based on Stripe redirect.
//
// Fix:
// - Refactored to use <SearchParamsWrapper> (with Suspense) to handle query params safely.
// - Prevents build errors caused by using useSearchParams() directly.

"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import CheckoutButton from "@/components/payments/CheckoutButton";
import SearchParamsWrapper from "@/components/utils/searchParamsWrapper";

// ------------------------------
// Inner handler for query params
// ------------------------------
// This component runs inside <SearchParamsWrapper> so that
// useSearchParams() is always inside a Suspense boundary.
// It listens for ?success=true or ?canceled=true after Stripe checkout.
function UpgradeToastHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success) {
      toast.success("🎉 Payment successful! You now have full access.", {
        duration: 6000,
      });
      // ✅ Clean the URL so the toast won’t repeat on refresh
      window.history.replaceState(null, "", window.location.pathname);
    }

    if (canceled) {
      toast.error("❌ Payment canceled. No changes were made.", {
        duration: 6000,
      });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams]);

  return null; // no UI, only toast side effects
}

// ------------------------------
// Main Upgrade Page
// ------------------------------
export default function UpgradePage() {
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      {/* ✅ Toast handler safely wrapped with <SearchParamsWrapper> */}
      <SearchParamsWrapper>
        <UpgradeToastHandler />
      </SearchParamsWrapper>

      {/* Heading */}
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
        Upgrade Required
      </h1>

      {/* Subtext */}
      <p className="text-white text-lg sm:text-xl mb-6 text-center max-w-xl">
        🚀 Unlock the Interactive Map and Course Content by purchasing a
        package. Choose the option that fits you best.
      </p>

      {/* Package Buttons using reusable <CheckoutButton /> */}
      <div className="flex flex-col sm:flex-row gap-6">
        <CheckoutButton
          packageType="individual"
          label="Buy Individual Package ($50)"
          className="bg-green-600 hover:bg-green-500 text-white"
        />
        <CheckoutButton
          packageType="business"
          label="Buy Business Package ($150)"
          className="bg-blue-600 hover:bg-blue-500 text-white"
        />
      </div>
    </section>
  );
}

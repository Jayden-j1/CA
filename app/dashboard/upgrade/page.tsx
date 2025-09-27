// app/dashboard/upgrade/page.tsx
//
// Updated:
// - Added explicit error handling for failed Stripe payments.

"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import CheckoutButton from "@/components/payments/CheckoutButton";
import SearchParamsWrapper from "@/components/utils/searchParamsWrapper";

function UpgradeToastHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    const error = searchParams.get("error"); // NEW

    if (success) {
      toast.success("🎉 Payment successful! You now have full access.", {
        duration: 6000,
      });
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

  return null;
}

export default function UpgradePage() {
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      <SearchParamsWrapper>
        <UpgradeToastHandler />
      </SearchParamsWrapper>

      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
        Upgrade Required
      </h1>
      <p className="text-white text-lg sm:text-xl mb-6 text-center max-w-xl">
        🚀 Unlock the Interactive Map and Course Content by purchasing a package.
      </p>

      <div className="flex flex-col sm:flex-row gap-6">
        <CheckoutButton
          packageType="individual"
          label={`Buy Individual Package ($${process.env.NEXT_PUBLIC_INDIVIDUAL_PRICE})`}
          className="bg-green-600 hover:bg-green-500 text-white"
        />
        <CheckoutButton
          packageType="business"
          label={`Buy Business Package ($${process.env.NEXT_PUBLIC_BUSINESS_PRICE})`}
          className="bg-blue-600 hover:bg-blue-500 text-white"
        />
      </div>
    </section>
  );
}

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
// - Supports staff seat purchases too, future-proof for business owners.
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
function UpgradeToastHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    const error = searchParams.get("error");

    if (success) {
      toast.success("🎉 Payment successful! You now have full access.", {
        duration: 2000,
      });
      window.history.replaceState(null, "", window.location.pathname);
    }

    if (canceled) {
      toast.error("❌ Payment canceled. No changes were made.", {
        duration: 2000,
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
// Main Upgrade Page
// ------------------------------
export default function UpgradePage() {
  // ✅ Read display prices from env
  const individualPrice = process.env.NEXT_PUBLIC_INDIVIDUAL_PRICE || "80";
  const businessPrice = process.env.NEXT_PUBLIC_BUSINESS_PRICE || "200";
  const staffSeatPrice = process.env.NEXT_PUBLIC_STAFF_SEAT_PRICE || "50";

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

      {/* Package Buttons */}
      <div className="flex flex-col sm:flex-row gap-6">
        <CheckoutButton
          packageType="individual"
          label={`Buy Individual Package ($${individualPrice})`}
          className="bg-green-600 hover:bg-green-500 text-white cursor-pointer"
        />
        <CheckoutButton
          packageType="business"
          label={`Buy Business Package ($${businessPrice})`}
          className="bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
        />
        <CheckoutButton
          packageType="staff_seat"
          label={`Add Staff Seat ($${staffSeatPrice})`}
          className="bg-yellow-600 hover:bg-yellow-500 text-white cursor-pointer"
        />
      </div>
    </section>
  );
}

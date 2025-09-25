// app/dashboard/upgrade/page.tsx
//
// Purpose:
// - Shown to logged-in users who have NOT purchased a package.
// - Encourages upgrading to unlock Map + Course Content.
// - Uses reusable <CheckoutButton /> for Stripe checkout.
// - Displays success/error toasts based on Stripe redirect.
//
// Fix:
// - Wrapped useSearchParams() in Suspense to resolve Vercel build error.

"use client";

import { useEffect } from "react";
import { Suspense } from "react"; // ✅ Needed for useSearchParams
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import CheckoutButton from "@/components/payments/CheckoutButton";

// ------------------------------
// Inner handler for query params
// ------------------------------
function UpgradeToastHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

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
  }, [searchParams]);

  return null;
}

export default function UpgradePage() {
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      {/* ✅ Toast handler wrapped in Suspense */}
      <Suspense fallback={null}>
        <UpgradeToastHandler />
      </Suspense>

      {/* Heading */}
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
        Upgrade Required
      </h1>

      {/* Subtext */}
      <p className="text-white text-lg sm:text-xl mb-6 text-center max-w-xl">
        🚀 Unlock the Interactive Map and Course Content by purchasing a
        package. Choose the option that fits you best.
      </p>

      {/* Package Buttons using reusable component */}
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

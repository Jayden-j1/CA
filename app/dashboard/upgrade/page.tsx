// app/dashboard/upgrade/page.tsx
//
// Purpose
// -------
// Upgrade page that shows relevant purchase options.
// • Individuals: only "Buy Individual Package"
// • Business owners / staff / admins: original options
//
// What changed (minimal):
// -----------------------
// • Added session-based filtering using useSession()
// • Kept your toast handler + Suspense wrapper unchanged
//
// Pillars
// -------
// ✅ Efficiency  – simple client-side filter (no extra API roundtrips)
// ✅ Robustness  – null-safe searchParams reads preserved
// ✅ Simplicity  – tiny conditional render block
// ✅ Ease of mgmt – behavior isolated to this page
// ✅ Security    – prices still resolved server-side in /api/checkout/create-session

"use client";

import { Suspense, useMemo } from "react";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import CheckoutButton from "@/components/payments/CheckoutButton";
import SearchParamsWrapper from "@/components/utils/searchParamsWrapper";

function UpgradeToastHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // ✅ Null-safe param reads
    const success = (searchParams?.get("success") ?? "") === "true";
    const canceled = (searchParams?.get("canceled") ?? "") === "true";
    const error = searchParams?.get("error") ?? "";

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

export default function UpgradePage() {
  const { data: session } = useSession();

  // Prices (labels only; real amounts are checked server-side)
  const individualPrice = process.env.NEXT_PUBLIC_INDIVIDUAL_PRICE || "80";
  const businessPrice = process.env.NEXT_PUBLIC_BUSINESS_PRICE || "200";
  const staffSeatPrice = process.env.NEXT_PUBLIC_STAFF_SEAT_PRICE || "50";

  // Determine if this user is an "individual" account
  const isIndividualUser = useMemo(() => {
    const role = session?.user?.role ?? "USER";
    const businessId = session?.user?.businessId ?? null;
    return role === "USER" && businessId === null;
  }, [session?.user?.role, session?.user?.businessId]);

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      {/* ✅ Suspense boundary to safely use useSearchParams() */}
      <Suspense fallback={null}>
        <SearchParamsWrapper>
          <UpgradeToastHandler />
        </SearchParamsWrapper>
      </Suspense>

      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
        Upgrade Required
      </h1>
      <p className="text-white text-lg sm:text-xl mb-6 text-center max-w-xl">
        🚀 Unlock the Interactive Map and Course Content by purchasing a package.
      </p>

      {/* Conditional options:
         - Individual users → only individual package
         - Otherwise → full set (business/staff flows remain unchanged) */}
      <div className="flex flex-col sm:flex-row gap-6">
        {isIndividualUser ? (
          <CheckoutButton
            packageType="individual"
            label={`Buy Individual Package ($${individualPrice})`}
            className="bg-green-600 hover:bg-green-500 text-white cursor-pointer"
          />
        ) : (
          <>
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
          </>
        )}
      </div>
    </section>
  );
}

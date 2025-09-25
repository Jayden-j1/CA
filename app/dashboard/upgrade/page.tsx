// app/dashboard/upgrade/page.tsx
//
// Purpose:
// - Shown to logged-in users who have NOT purchased a package.
// - Encourages upgrading to unlock Map + Course Content.
// - Integrates with /api/payments to create a Stripe Checkout session.
// - After Stripe redirects back (?success / ?canceled),
//   display toast feedback so users know what happened.
//
// Dependencies:
// - react-hot-toast (for toasts).
// - /api/payments API route (already exists).

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation"; // ✅ to detect Stripe return params
import toast from "react-hot-toast";

export default function UpgradePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const searchParams = useSearchParams();

  // ------------------------------
  // Handle Stripe success/canceled redirects
  // ------------------------------
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success) {
      toast.success("🎉 Payment successful! You now have full access.", {
        duration: 6000,
      });
      // ✅ Clean query params so toast won’t repeat on refresh
      window.history.replaceState(null, "", window.location.pathname);
    }

    if (canceled) {
      toast.error("❌ Payment canceled. No changes were made.", {
        duration: 6000,
      });
      // ✅ Clean query params
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams]);

  // ------------------------------
  // Checkout handler
  // ------------------------------
  const handleCheckout = async (packageType: "individual" | "business") => {
    setLoading(true);
    setError("");

    try {
      // Call backend → /api/payments
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: packageType === "individual" ? 5000 : 15000, // AUD $50 or $150
          currency: "aud",
          description:
            packageType === "individual"
              ? "Individual Package"
              : "Business Package",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error || "Failed to start checkout");
        setLoading(false);
        return;
      }

      // ✅ Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  // ------------------------------
  // Render page
  // ------------------------------
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      {/* Heading */}
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
        Upgrade Required
      </h1>

      {/* Subtext */}
      <p className="text-white text-lg sm:text-xl mb-6 text-center max-w-xl">
        🚀 Unlock the Interactive Map and Course Content by purchasing a package.
        Choose the option that fits you best.
      </p>

      {/* Error message (if any API issue) */}
      {error && <p className="text-red-300 mb-4">{error}</p>}

      {/* Package Buttons */}
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Individual Package */}
        <button
          disabled={loading}
          onClick={() => handleCheckout("individual")}
          className="px-6 py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-2xl shadow-lg border-2 border-white disabled:opacity-50"
        >
          {loading ? "Loading..." : "Buy Individual Package ($50)"}
        </button>

        {/* Business Package */}
        <button
          disabled={loading}
          onClick={() => handleCheckout("business")}
          className="px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-lg border-2 border-white disabled:opacity-50"
        >
          {loading ? "Loading..." : "Buy Business Package ($150)"}
        </button>
      </div>
    </section>
  );
}

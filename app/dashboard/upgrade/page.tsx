// app/dashboard/upgrade/page.tsx
//
// Purpose:
// - Shown to logged-in users who have NOT purchased a package.
// - Encourages upgrading to unlock Map + Course Content.
// - Integrates with /api/payments to create a Stripe Checkout session.
//
// Notes:
// - Uses fetch → /api/payments (which you already have).
// - Business rules can adjust available packages.

"use client";

import { useState } from "react";

export default function UpgradePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Handler → call /api/payments
  const handleCheckout = async (packageType: "individual" | "business") => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: packageType === "individual" ? 5000 : 15000, // AUD $50 or $150 (example)
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

      //  Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
        Upgrade Required
      </h1>
      <p className="text-white text-lg sm:text-xl mb-6 text-center max-w-xl">
        🚀 Unlock the Interactive Map and Course Content by purchasing a
        package. Choose the option that fits you best.
      </p>

      {/* Error message */}
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

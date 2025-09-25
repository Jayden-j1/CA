// components/payments/CheckoutButton.tsx
//
// Purpose:
// - A reusable button that starts a Stripe Checkout session.
// - Can be dropped into any page (public /services OR internal /dashboard/upgrade).
// - Accepts props for package type, label, and styling.
// - Handles API call → /api/payments → redirect to Stripe.
//
// Notes:
// - "packageType" determines amount + description.
// - Displays loading state while waiting for Stripe URL.
// - Reports API errors inline (toast or text).

"use client";

import { useState } from "react";

interface CheckoutButtonProps {
  packageType: "individual" | "business"; // Determines price + description
  label: string;                          // Button text (e.g. "Buy Individual Package")
  className?: string;                     // Tailwind styling classes
}

export default function CheckoutButton({
  packageType,
  label,
  className,
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  // ------------------------------
  // Handle checkout
  // ------------------------------
  const handleCheckout = async () => {
    setLoading(true);

    try {
      // 1) Call backend API
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

      // 2) Handle API errors
      if (!res.ok || !data.url) {
        alert(data.error || "Failed to start checkout");
        setLoading(false);
        return;
      }

      // 3) Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      console.error("[CheckoutButton] Error:", err);
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <button
      disabled={loading}
      onClick={handleCheckout}
      className={`px-6 py-4 font-bold rounded-2xl shadow-lg border-2 border-white disabled:opacity-50 ${className}`}
    >
      {loading ? "Loading..." : label}
    </button>
  );
}

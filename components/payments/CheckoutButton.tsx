// components/payments/CheckoutButton.tsx
//
// Purpose:
// - Client button that POSTs to /api/checkout/create-session and redirects to Stripe Checkout.
// - Prices are read from env vars (NEXT_PUBLIC_*).
//
// UX:
// - Disabled state while redirecting
// - Clear toasts for errors
//
// Security:
// - No price sent from client, only packageType. Server enforces real amount.
// - Now supports "staff_seat" packageType for business staff billing.

"use client";

import { useState } from "react";
import toast from "react-hot-toast";

interface CheckoutButtonProps {
  packageType: "individual" | "business" | "staff_seat"; // ✅ extended
  label?: string;
  className?: string;
}

export default function CheckoutButton({
  packageType,
  label,
  className = "",
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  // ✅ Fallback auto-labels based on type
  const defaultLabel =
    packageType === "individual"
      ? `Buy Individual Package ($${process.env.NEXT_PUBLIC_INDIVIDUAL_PRICE})`
      : packageType === "business"
      ? `Buy Business Package ($${process.env.NEXT_PUBLIC_BUSINESS_PRICE})`
      : `Add Staff Seat ($${process.env.NEXT_PUBLIC_STAFF_SEAT_PRICE})`;

  const handleCheckout = async () => {
    try {
      setLoading(true);

      // 1) Call server API to create session
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageType }),
      });

      const data = await res.json();

      if (!res.ok || !data?.url) {
        toast.error(data.error || "Unable to start checkout");
        setLoading(false);
        return;
      }

      // 2) Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      console.error("[CheckoutButton] error:", err);
      toast.error("Unexpected error starting checkout");
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className={`px-6 py-3 rounded-full transition-colors duration-300 font-semibold ${className} ${
        loading ? "opacity-70 cursor-not-allowed" : ""
      }`}
    >
      {loading ? "Redirecting..." : (label || defaultLabel)}
    </button>
  );
}

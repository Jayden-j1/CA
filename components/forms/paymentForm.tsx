'use client';

import { useState, FormEvent } from "react";

interface PaymentFormProps {
  description: string;
  amount: number;
  currency: string;
}

export default function PaymentForm({ description, amount, currency }: PaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency, description }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Payment failed");
        setLoading(false);
        return;
      }

      // Redirect to Stripe checkout
      window.location.href = data.url;
    } catch (error) {
      console.error(error);
      setMessage("Internal error");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px] p-6 bg-blue-700 rounded-xl">
      <p className="text-white font-bold">Payment for: {description}</p>
      <p className="text-white font-semibold">Amount: ${amount.toFixed(2)}</p>

      <button
        type="submit"
        disabled={loading}
        className="px-6 py-3 bg-green-600 text-white rounded-full font-bold hover:bg-green-500 transition-colors cursor-pointer"
      >
        {loading ? "Processing..." : "Pay Now"}
      </button>

      {message && <p className="text-white mt-2">{message}</p>}
    </form>
  );
}

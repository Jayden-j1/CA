'use client';

import { useState, FormEvent } from "react";
import AddStaffForm from "./addStaffForm";
import PaymentForm from "./paymentForm";

export default function AddStaffWithPaymentForm() {
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pricePerStaff] = useState(10); // Example fee

  const checkPayment = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/staff/paymentCheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricePerStaff }),
      });
      const data = await res.json();
      setRequiresPayment(data.requiresPayment);
      if (data.requiresPayment && data.url) {
        window.location.href = data.url; // Redirect to Stripe
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {requiresPayment ? (
        <PaymentForm description="Add Staff Member" amount={pricePerStaff} currency="aud" />
      ) : (
        <>
          <button
            onClick={checkPayment}
            className="px-6 py-3 bg-green-600 text-white rounded-full font-bold hover:bg-green-500 transition-colors"
          >
            {loading ? "Checking..." : "Add Staff"}
          </button>

          {/* Show form only if payment not required */}
          {!requiresPayment && <AddStaffForm />}
        </>
      )}
    </div>
  );
}

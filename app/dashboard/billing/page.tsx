// app/dashboard/billing/page.tsx
//
// Purpose:
// - Dashboard page that lists ALL payments for the logged-in user.
// - Useful for regular users (to see history) and especially for business owners/admins.
// - Calls /api/payments/history (new API you’ll create) to fetch all payment records.
// - Shows amount, description, and purchase date.
//
// Notes:
// - Requires user to be logged in (middleware protects /dashboard/*).
// - Relies on backend endpoint for data (no direct Prisma call here).
// - Could be extended later to show invoices, receipts, etc.

"use client";

import { useEffect, useState } from "react";

// ------------------------------
// Shape of API response
// ------------------------------
interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  description: string;
  createdAt: string;
}

export default function BillingPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ✅ Fetch payment history
  const fetchPayments = async () => {
    try {
      const res = await fetch("/api/payments/history");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load payments");
      }

      setPayments(data.payments);
    } catch (err: any) {
      console.error("[BillingPage] Error fetching payments:", err);
      setError(err.message || "Internal error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  // ------------------------------
  // Render
  // ------------------------------
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
        Billing & Payment History
      </h1>

      {loading ? (
        <p className="text-white">Loading payments...</p>
      ) : error ? (
        <p className="text-red-300">{error}</p>
      ) : payments.length === 0 ? (
        <p className="text-white">No payments found.</p>
      ) : (
        <div className="w-[90%] sm:w-[600px] md:w-[800px] bg-white rounded-xl shadow-xl p-6">
          <h2 className="font-bold text-xl mb-4">Your Payments</h2>
          <ul className="divide-y divide-gray-200">
            {payments.map((p) => (
              <li key={p.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-semibold">{p.description}</p>
                  <p className="text-gray-500 text-sm">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <p className="font-bold">
                  ${p.amount} {p.currency.toUpperCase()}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

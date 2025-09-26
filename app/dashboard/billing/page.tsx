// app/dashboard/billing/page.tsx
//
// Purpose:
// - Dashboard billing page with payment history.
// - Supports filtering by purpose: Show All, Packages, Staff Seats.
// - Makes it easier to distinguish subscription payments from staff seat purchases.
//
// Updates in this version:
// - Added <FilterToggle> component.
// - Added state for current filter (ALL | PACKAGE | STAFF_SEAT).
// - Payment table respects selected filter.
// - UI highlights active filter option.
//
// Notes:
// - Payments are fetched from /api/payments/history with a `purpose` field.
// - Admins still see a "User" column with who paid.

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
  purpose: "PACKAGE" | "STAFF_SEAT";
  createdAt: string;
  user?: {
    email: string;
    name: string | null;
    role: string;
  };
}

// ------------------------------
// Small badge for payment purpose
// ------------------------------
function PurposeBadge({ purpose }: { purpose: "PACKAGE" | "STAFF_SEAT" }) {
  const style =
    purpose === "STAFF_SEAT"
      ? "bg-yellow-100 text-yellow-800"
      : "bg-green-100 text-green-800";

  const label = purpose === "STAFF_SEAT" ? "Staff Seat" : "Package";

  return (
    <span
      className={`${style} text-xs px-2 py-0.5 rounded font-semibold tracking-wide`}
    >
      {label}
    </span>
  );
}

// ------------------------------
// Filter Toggle component
// ------------------------------
function FilterToggle({
  filter,
  setFilter,
}: {
  filter: "ALL" | "PACKAGE" | "STAFF_SEAT";
  setFilter: (val: "ALL" | "PACKAGE" | "STAFF_SEAT") => void;
}) {
  const options: ("ALL" | "PACKAGE" | "STAFF_SEAT")[] = [
    "ALL",
    "PACKAGE",
    "STAFF_SEAT",
  ];

  return (
    <div className="flex gap-2 mb-6">
      {options.map((opt) => {
        const label =
          opt === "ALL" ? "Show All" : opt === "PACKAGE" ? "Packages" : "Staff Seats";
        const active = filter === opt;
        return (
          <button
            key={opt}
            onClick={() => setFilter(opt)}
            className={`px-4 py-1 rounded-full border text-sm font-semibold transition ${
              active
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------
// Billing Page Component
// ------------------------------
export default function BillingPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"ALL" | "PACKAGE" | "STAFF_SEAT">("ALL");

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

  // ✅ Apply filter before rendering
  const filteredPayments =
    filter === "ALL"
      ? payments
      : payments.filter((p) => p.purpose === filter);

  // ------------------------------
  // Render
  // ------------------------------
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
        Billing & Payment History
      </h1>

      {/* Filter toggle */}
      <FilterToggle filter={filter} setFilter={setFilter} />

      {loading ? (
        <p className="text-white">Loading payments...</p>
      ) : error ? (
        <p className="text-red-300">{error}</p>
      ) : filteredPayments.length === 0 ? (
        <p className="text-white">No payments found for this filter.</p>
      ) : (
        <div className="w-[90%] sm:w-[600px] md:w-[900px] bg-white rounded-xl shadow-xl p-6 overflow-x-auto">
          <h2 className="font-bold text-xl mb-4">Payment Records</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b border-gray-300">
                {filteredPayments[0]?.user && <th className="py-2 px-3">User</th>}
                <th className="py-2 px-3">Description</th>
                <th className="py-2 px-3">Purpose</th>
                <th className="py-2 px-3">Amount</th>
                <th className="py-2 px-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p) => (
                <tr key={p.id} className="border-b border-gray-200">
                  {p.user && (
                    <td className="py-2 px-3 text-sm text-gray-700">
                      {p.user.name || "Unnamed"} <br />
                      <span className="text-xs text-gray-500">{p.user.email}</span>
                      <br />
                      <span className="text-xs text-gray-400">({p.user.role})</span>
                    </td>
                  )}
                  <td className="py-2 px-3">{p.description}</td>
                  <td className="py-2 px-3">
                    <PurposeBadge purpose={p.purpose} />
                  </td>
                  <td className="py-2 px-3 font-bold">
                    ${p.amount} {p.currency.toUpperCase()}
                  </td>
                  <td className="py-2 px-3">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

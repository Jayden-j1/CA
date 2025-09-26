// app/dashboard/billing/page.tsx
//
// Purpose:
// - Billing dashboard with payment history.
// - Now fetches payments with server-side filtering (purpose + user).
// - Admins can filter by both purpose AND user email.
// - Filters persist in localStorage for convenience.
//
// Key UX:
// - Purpose filter toggle (All / Package / Staff Seat).
// - Admin-only user filter dropdown (all users who appear in data).
// - Payments re-fetched whenever filters change.
// - LocalStorage persistence means filters survive refresh/session.

"use client";

import { useEffect, useState } from "react";

// ------------------------------
// API response shape
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
// Badge component for purpose
// ------------------------------
function PurposeBadge({ purpose }: { purpose: "PACKAGE" | "STAFF_SEAT" }) {
  const style =
    purpose === "STAFF_SEAT"
      ? "bg-yellow-100 text-yellow-800"
      : "bg-green-100 text-green-800";

  return (
    <span className={`${style} text-xs px-2 py-0.5 rounded font-semibold`}>
      {purpose === "STAFF_SEAT" ? "Staff Seat" : "Package"}
    </span>
  );
}

export default function BillingPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ------------------------------
  // Filters
  // ------------------------------
  const [purposeFilter, setPurposeFilter] = useState<
    "ALL" | "PACKAGE" | "STAFF_SEAT"
  >("ALL");
  const [userFilter, setUserFilter] = useState<string>("ALL");
  const [userOptions, setUserOptions] = useState<
    { email: string; name: string | null }[]
  >([]);

  // ------------------------------
  // Load persisted filters from localStorage (once on mount)
  // ------------------------------
  useEffect(() => {
    const savedPurpose = localStorage.getItem("billingFilterPurpose");
    const savedUser = localStorage.getItem("billingFilterUser");

    if (savedPurpose === "PACKAGE" || savedPurpose === "STAFF_SEAT") {
      setPurposeFilter(savedPurpose);
    }
    if (savedUser) {
      setUserFilter(savedUser);
    }
  }, []);

  // ------------------------------
  // Persist filters to localStorage whenever they change
  // ------------------------------
  useEffect(() => {
    localStorage.setItem("billingFilterPurpose", purposeFilter);
    localStorage.setItem("billingFilterUser", userFilter);
  }, [purposeFilter, userFilter]);

  // ------------------------------
  // Fetch payments from server API
  // ------------------------------
  const fetchPayments = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();

      if (purposeFilter !== "ALL") {
        params.set("purpose", purposeFilter);
      }
      if (userFilter !== "ALL") {
        params.set("user", userFilter);
      }

      const url = `/api/payments/history${
        params.toString() ? `?${params.toString()}` : ""
      }`;

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load payments");
      }

      setPayments(data.payments);

      // If admin, build dropdown user options
      if (data.payments.length > 0 && data.payments[0].user) {
        const uniqueUsers: Record<string, { email: string; name: string | null }> = {};
        data.payments.forEach((p: PaymentRecord) => {
          if (p.user) uniqueUsers[p.user.email] = { email: p.user.email, name: p.user.name };
        });
        setUserOptions(Object.values(uniqueUsers));
      }
    } catch (err: any) {
      console.error("[BillingPage] Fetch error:", err);
      setError(err.message || "Internal error");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------
  // Re-fetch whenever filters change
  // ------------------------------
  useEffect(() => {
    fetchPayments();
  }, [purposeFilter, userFilter]);

  // ------------------------------
  // Render
  // ------------------------------
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
        Billing & Payment History
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Purpose filter */}
        <div className="flex gap-2">
          {["ALL", "PACKAGE", "STAFF_SEAT"].map((opt) => (
            <button
              key={opt}
              onClick={() => setPurposeFilter(opt as any)}
              className={`px-3 py-1 rounded text-sm font-bold ${
                purposeFilter === opt
                  ? "bg-white text-blue-600"
                  : "bg-white/70 text-blue-900"
              }`}
            >
              {opt === "ALL"
                ? "All"
                : opt === "PACKAGE"
                ? "Packages"
                : "Staff Seats"}
            </button>
          ))}
        </div>

        {/* User filter (admins only) */}
        {userOptions.length > 0 && (
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="px-3 py-1 rounded text-sm font-bold bg-white/70 text-blue-900"
          >
            <option value="ALL">All Users</option>
            {userOptions.map((u) => (
              <option key={u.email} value={u.email}>
                {u.name || u.email} ({u.email})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-white">Loading payments...</p>
      ) : error ? (
        <p className="text-red-300">{error}</p>
      ) : payments.length === 0 ? (
        <p className="text-white">No payments found.</p>
      ) : (
        <div className="w-[90%] sm:w-[600px] md:w-[1000px] bg-white rounded-xl shadow-xl p-6 overflow-x-auto">
          <h2 className="font-bold text-xl mb-4">Payment Records</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b border-gray-300">
                {payments[0]?.user && <th className="py-2 px-3">User</th>}
                <th className="py-2 px-3">Description</th>
                <th className="py-2 px-3">Purpose</th>
                <th className="py-2 px-3">Amount</th>
                <th className="py-2 px-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
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

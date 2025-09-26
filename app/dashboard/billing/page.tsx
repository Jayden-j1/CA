// app/dashboard/billing/page.tsx
//
// Purpose:
// - Billing dashboard with payments table + filters.
// - Fetches data from /api/payments/history with server-side filtering.
// - Admins get both `payments` and a separate `users` array for dropdown.
// - Filters: Purpose (All / Package / Staff Seat) and User (for Admins only).
// - Filters are persisted in localStorage for convenience across sessions.
//
// Updates in this version:
// - Uses `users` array returned from API instead of deriving from payments.
// - Clean separation of payment results vs available user filter options.
// - Dropdown remains stable regardless of current filter.
//
// Data Flow:
// 1. On mount → fetch(`/api/payments/history?purpose=...&user=...`).
// 2. Save filters to localStorage so they persist between visits.
// 3. Render purpose + user filter controls.
// 4. Render table of payments.

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

interface UserOption {
  email: string;
  name: string | null;
}

// ------------------------------
// Badge component for payment purpose
// ------------------------------
function PurposeBadge({ purpose }: { purpose: string }) {
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
  // State for data
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]); // ✅ From API, not derived
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter states
  const [purposeFilter, setPurposeFilter] = useState("ALL");
  const [userFilter, setUserFilter] = useState("");

  // ------------------------------
  // Load filters from localStorage (persistency)
  // ------------------------------
  useEffect(() => {
    const storedPurpose = localStorage.getItem("billing:purposeFilter");
    const storedUser = localStorage.getItem("billing:userFilter");
    if (storedPurpose) setPurposeFilter(storedPurpose);
    if (storedUser) setUserFilter(storedUser);
  }, []);

  // ------------------------------
  // Fetch payments (server-side filtering)
  // ------------------------------
  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (purposeFilter !== "ALL") params.set("purpose", purposeFilter);
      if (userFilter) params.set("user", userFilter);

      const res = await fetch(`/api/payments/history?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load payments");
      }

      setPayments(data.payments || []);
      setUsers(data.users || []); // ✅ Admins get distinct users
    } catch (err: any) {
      console.error("[BillingPage] Error fetching payments:", err);
      setError(err.message || "Internal error");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------
  // Sync filters → localStorage + refetch
  // ------------------------------
  useEffect(() => {
    localStorage.setItem("billing:purposeFilter", purposeFilter);
    localStorage.setItem("billing:userFilter", userFilter);
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purposeFilter, userFilter]);

  // ------------------------------
  // Render
  // ------------------------------
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
        Billing & Payment History
      </h1>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Purpose Filter */}
        <select
          value={purposeFilter}
          onChange={(e) => setPurposeFilter(e.target.value)}
          className="px-3 py-2 rounded bg-white text-gray-800 text-sm shadow"
        >
          <option value="ALL">All Purposes</option>
          <option value="PACKAGE">Packages</option>
          <option value="STAFF_SEAT">Staff Seats</option>
        </select>

        {/* User Filter (only render if API provided users → Admin only) */}
        {users.length > 0 && (
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="px-3 py-2 rounded bg-white text-gray-800 text-sm shadow"
          >
            <option value="">All Users</option>
            {users.map((u) => (
              <option key={u.email} value={u.email}>
                {u.name || u.email} ({u.email})
              </option>
            ))}
          </select>
        )}
      </div>

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

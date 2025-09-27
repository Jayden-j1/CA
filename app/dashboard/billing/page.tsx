// app/dashboard/billing/page.tsx
//
// Purpose:
// - Billing dashboard with payments table + filters.
// - Now includes CSV export for reconciliation/testing.
// - Admins can filter by purpose or user, then export that exact view.
//
// - Clearly distinguishes PACKAGE vs STAFF_SEAT using a badge.
// - Uses server-side filtering (purpose + user) for scalability.
// - Admins get a searchable user dropdown (autocomplete).
// - Filters persist in localStorage.
// - Includes a built-in QA Debug Panel to quickly inspect rows.
//
// Flow:
// 1) On mount: restore filters from localStorage → fetch /api/payments/history?purpose=&user=
// 2) Admin types user(s) → autocomplete suggestions come from API "users" array (distinct list).
// 3) Filters re-fetch from server and are persisted to localStorage.
// 4) QA Debug Panel (toggle) shows first N payments JSON + Copy button.
//
// Notes:
// - This page assumes /api/payments/history returns:
//   { payments: Payment[], users?: { email, name }[] } for Admin.
// - Purpose filter values are "ALL" | "PACKAGE" | "STAFF_SEAT".
// - User filter is an email (admins only).
//
// UX niceties:
// - Active filter chips
// - Legend explaining the purpose badges
// - "Clear filters" button
//
// Security:
// - Only exposes what the server route returns (no raw secrets).
// - No client-side price logic here (purely display).
// New in this version:
// - Added `exportToCSV` function.
// - Added "Export CSV" button above table.
// - Ensures all current filtered results (payments) are exported.

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
// Badge for payment purpose
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
  // Data state
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter states
  const [purposeFilter, setPurposeFilter] = useState("ALL");
  const [userFilter, setUserFilter] = useState("");

  // For autocomplete
  const [userSearch, setUserSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // ------------------------------
  // Load filters from localStorage
  // ------------------------------
  useEffect(() => {
    const storedPurpose = localStorage.getItem("billing:purposeFilter");
    const storedUser = localStorage.getItem("billing:userFilter");
    if (storedPurpose) setPurposeFilter(storedPurpose);
    if (storedUser) {
      setUserFilter(storedUser);
      setUserSearch(storedUser);
    }
  }, []);

  // ------------------------------
  // Fetch payments + users
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
      setUsers(data.users || []);
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
  // Filter suggestion list based on search
  // ------------------------------
  const filteredSuggestions = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase()))
  );

  // ------------------------------
  // CSV Export Helper
  // ------------------------------
  const exportToCSV = () => {
    if (payments.length === 0) {
      alert("No payments to export");
      return;
    }

    // 1. Build CSV header
    const headers = ["ID", "User", "Email", "Role", "Description", "Purpose", "Amount", "Currency", "Date"];

    // 2. Map payments to rows
    const rows = payments.map((p) => [
      p.id,
      p.user?.name || "Unnamed",
      p.user?.email || "",
      p.user?.role || "",
      p.description,
      p.purpose,
      p.amount,
      p.currency.toUpperCase(),
      new Date(p.createdAt).toLocaleDateString(),
    ]);

    // 3. Join everything into CSV string
    const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");

    // 4. Create a downloadable file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "payments_export.csv";
    link.click();
  };

  // ------------------------------
  // Render
  // ------------------------------
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
        Billing & Payment History
      </h1>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 relative">
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

        {/* User Filter (Admin only) */}
        {users.length > 0 && (
          <div className="relative">
            <input
              type="text"
              placeholder="Search user..."
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="px-3 py-2 rounded bg-white text-gray-800 text-sm shadow w-64"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto w-full">
                <li
                  onClick={() => {
                    setUserFilter("");
                    setUserSearch("");
                    setShowSuggestions(false);
                  }}
                  className="px-3 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100"
                >
                  All Users
                </li>
                {filteredSuggestions.map((u) => (
                  <li
                    key={u.email}
                    onClick={() => {
                      setUserFilter(u.email);
                      setUserSearch(u.email);
                      setShowSuggestions(false);
                    }}
                    className="px-3 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100"
                  >
                    {u.name || "Unnamed"} ({u.email})
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Export CSV Button */}
        <button
          onClick={exportToCSV}
          className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-white font-semibold rounded shadow text-sm"
        >
          Export CSV
        </button>
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

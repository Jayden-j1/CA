// app/dashboard/billing/page.tsx
//
// Purpose:
// - Billing dashboard with a payments table + robust filters.
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

"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

// ------------------------------
// Types (matches /api/payments/history)
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
// Purpose badge
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

// ------------------------------
// Small legend explaining badges
// ------------------------------
function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs text-white/90">
      <div className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-300" />
        <span>Package</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded bg-yellow-100 border border-yellow-300" />
        <span>Staff Seat</span>
      </div>
    </div>
  );
}

// ------------------------------
// QA Debug panel: first N rows JSON + copy
// ------------------------------
function DebugPanel({ payments }: { payments: PaymentRecord[] }) {
  const [open, setOpen] = useState(false);
  const sample = useMemo(
    () => JSON.stringify(payments.slice(0, 20), null, 2),
    [payments]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sample);
      toast.success("Copied first 20 rows to clipboard");
    } catch {
      toast.error("Unable to copy");
    }
  };

  return (
    <div className="w-full mt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs px-3 py-1 rounded bg-gray-800 text-white hover:bg-gray-700"
      >
        {open ? "Hide" : "Show"} QA Debug (first 20 rows)
      </button>
      {open && (
        <div className="mt-2 bg-gray-900 text-green-200 rounded p-3 text-xs overflow-auto max-h-64">
          <div className="flex justify-between items-center mb-2">
            <span>Rows: {payments.length}</span>
            <button
              onClick={copy}
              className="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600"
            >
              Copy JSON
            </button>
          </div>
          <pre className="whitespace-pre-wrap">{sample}</pre>
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  // ------------------------------
  // Data state
  // ------------------------------
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ------------------------------
  // Filter states (persisted)
  // ------------------------------
  const [purposeFilter, setPurposeFilter] = useState<"ALL" | "PACKAGE" | "STAFF_SEAT">("ALL");
  const [userFilter, setUserFilter] = useState<string>("");

  // Autocomplete states
  const [userSearch, setUserSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // ------------------------------
  // Restore filters from localStorage
  // ------------------------------
  useEffect(() => {
    const storedPurpose = localStorage.getItem("billing:purposeFilter");
    const storedUser = localStorage.getItem("billing:userFilter");

    if (storedPurpose === "PACKAGE" || storedPurpose === "STAFF_SEAT" || storedPurpose === "ALL") {
      setPurposeFilter(storedPurpose);
    }
    if (storedUser) {
      setUserFilter(storedUser);
      setUserSearch(storedUser); // show saved email in input
    }
  }, []);

  // ------------------------------
  // Fetch payments + users (server-side filtering)
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
      // Admins will receive a distinct users list; others get undefined/[]
      setUsers(Array.isArray(data.users) ? data.users : []);
      // Console-side QA log (handy during dev)
      console.log("[BillingPage] fetched", {
        count: data.payments?.length,
        filters: { purposeFilter, userFilter },
      });
    } catch (err: any) {
      console.error("[BillingPage] Error fetching payments:", err);
      setError(err.message || "Internal error");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------
  // Persist filters + refetch
  // ------------------------------
  useEffect(() => {
    localStorage.setItem("billing:purposeFilter", purposeFilter);
    localStorage.setItem("billing:userFilter", userFilter);
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purposeFilter, userFilter]);

  // ------------------------------
  // Search suggestions based on typed input
  // ------------------------------
  const filteredSuggestions = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase()))
  );

  // ------------------------------
  // Clear filters helper
  // ------------------------------
  const clearFilters = () => {
    setPurposeFilter("ALL");
    setUserFilter("");
    setUserSearch("");
    toast.success("Cleared filters");
  };

  // ------------------------------
  // Active filters chip (small summary)
  // ------------------------------
  const activeFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (purposeFilter !== "ALL") parts.push(`Purpose: ${purposeFilter}`);
    if (userFilter) parts.push(`User: ${userFilter}`);
    return parts.join(" • ");
  }, [purposeFilter, userFilter]);

  // ------------------------------
  // Render
  // ------------------------------
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      {/* Title */}
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-2">
        Billing & Payment History
      </h1>

      {/* Legend + Active Filters Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-[90%] sm:w-[600px] md:w-[1000px] mb-4">
        <Legend />
        {activeFilterLabel && (
          <div className="mt-2 sm:mt-0 text-xs text-white/90">
            Active: <span className="font-semibold">{activeFilterLabel}</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 relative">
        {/* Purpose */}
        <select
          value={purposeFilter}
          onChange={(e) => setPurposeFilter(e.target.value as "ALL" | "PACKAGE" | "STAFF_SEAT")}
          className="px-3 py-2 rounded bg-white text-gray-800 text-sm shadow"
        >
          <option value="ALL">All Purposes</option>
          <option value="PACKAGE">Packages</option>
          <option value="STAFF_SEAT">Staff Seats</option>
        </select>

        {/* User (admins only, if API returned distinct users array) */}
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

            {/* Suggestions dropdown */}
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

        {/* Clear */}
        <button
          onClick={clearFilters}
          className="px-3 py-2 rounded bg-white/80 hover:bg-white text-gray-800 text-sm shadow"
        >
          Clear filters
        </button>
      </div>

      {/* Table / States */}
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

          {/* QA JSON panel for quick inspection */}
          <DebugPanel payments={payments} />
        </div>
      )}
    </section>
  );
}

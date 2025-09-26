// app/dashboard/billing/page.tsx
//
// Purpose:
// - Dashboard billing page with persistent filters (Purpose + User).
// - Filters persist BOTH in URL (shareable) and localStorage (fallback).
//
// Key Updates:
// - Removed direct reliance on useSearchParams to avoid Suspense build errors.
// - Added sync to localStorage as a fallback.
// - On load: initialize from URL > then localStorage > then defaults.
// - On change: update both URL + localStorage.
// - Admins see an extra user filter dropdown.
//
// Benefits:
// - Reloads preserve filter state.
// - Bookmarked/shared URLs open with filters pre-applied.
// - Large org admins can filter by user.

"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

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
// Purpose Badge
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
// Filter Toggle (Purpose)
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
    <div className="flex gap-2 mb-4">
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
// Main Page
// ------------------------------
export default function BillingPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const router = useRouter();

  // ------------------------------
  // Filters (default = ALL)
  // ------------------------------
  const [filter, setFilterState] = useState<"ALL" | "PACKAGE" | "STAFF_SEAT">("ALL");
  const [userFilter, setUserFilterState] = useState<string>("ALL");

  // ------------------------------
  // Load filters from URL/localStorage on first mount
  // ------------------------------
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const purposeFromUrl = urlParams.get("purpose") as
      | "ALL"
      | "PACKAGE"
      | "STAFF_SEAT"
      | null;
    const userFromUrl = urlParams.get("user");

    const savedPurpose = localStorage.getItem("billingPurpose") as
      | "ALL"
      | "PACKAGE"
      | "STAFF_SEAT"
      | null;
    const savedUser = localStorage.getItem("billingUser");

    setFilterState(purposeFromUrl || savedPurpose || "ALL");
    setUserFilterState(userFromUrl || savedUser || "ALL");
  }, []);

  // ------------------------------
  // Persist filters to URL + localStorage whenever they change
  // ------------------------------
  useEffect(() => {
    if (filter || userFilter) {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("purpose", filter);
      if (userFilter !== "ALL") params.set("user", userFilter);

      // Update URL (without reload)
      router.replace(`?${params.toString()}`, { scroll: false });

      // Save locally too
      localStorage.setItem("billingPurpose", filter);
      localStorage.setItem("billingUser", userFilter);
    }
  }, [filter, userFilter, router]);

  // ------------------------------
  // Fetch payments from API
  // ------------------------------
  const fetchPayments = async () => {
    try {
      const res = await fetch("/api/payments/history");
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to load payments");
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
  // Unique users (for Admin dropdown)
  // ------------------------------
  const uniqueUsers = useMemo(() => {
    const users: { email: string; name: string | null }[] = [];
    const seen = new Set<string>();
    payments.forEach((p) => {
      if (p.user?.email && !seen.has(p.user.email)) {
        users.push({ email: p.user.email, name: p.user.name });
        seen.add(p.user.email);
      }
    });
    return users;
  }, [payments]);

  // ------------------------------
  // Apply filters
  // ------------------------------
  const filteredPayments = payments.filter((p) => {
    if (filter !== "ALL" && p.purpose !== filter) return false;
    if (userFilter !== "ALL" && p.user?.email !== userFilter) return false;
    return true;
  });

  // ------------------------------
  // Render
  // ------------------------------
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
        Billing & Payment History
      </h1>

      {/* Purpose filter */}
      <FilterToggle filter={filter} setFilter={setFilterState} />

      {/* User dropdown (admins only) */}
      {uniqueUsers.length > 0 && (
        <div className="mb-6">
          <label className="text-white font-semibold mr-2">Filter by User:</label>
          <select
            value={userFilter}
            onChange={(e) => setUserFilterState(e.target.value)}
            className="px-3 py-1 rounded border border-gray-300 text-sm"
          >
            <option value="ALL">All Users</option>
            {uniqueUsers.map((u) => (
              <option key={u.email} value={u.email}>
                {u.name || "Unnamed"} ({u.email})
              </option>
            ))}
          </select>
        </div>
      )}

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

// app/dashboard/billing/page.tsx
//
// Purpose:
// - Billing dashboard that lists payments with simple filters and CSV export.
// - (Fixed) React rule-of-hooks: ALL hooks now appear before any conditional returns.
//
// What changed (high level):
// - Moved all useState/useEffect/useMemo above the early return that shows the loading/redirect screen.
// - Guarded effects so they only run when the user is allowed to view billing.
//
// Pillars:
// - Efficiency: fetch only when allowed, debounce-heavy work not needed.
// - Robustness: server-side rules still enforced in /api/payments/history.
// - Simplicity & ease of management: minimal changes; same UX.
// - Security: UI guards mirror server rules, but server remains source of truth.

"use client";

import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

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
    role: string; // USER | ADMIN | BUSINESS_OWNER
  };
}

interface UserOption {
  email: string;
  name: string | null;
}

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

// ---------- Page wrapper with Suspense ----------
// (unchanged)
export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
          <p className="text-white text-xl">Loading billing…</p>
        </section>
      }
    >
      <BillingPageInner />
    </Suspense>
  );
}

// ---------- Main component (fixed hook order) ----------
function BillingPageInner() {
  // 1) ALWAYS declare hooks before any conditional return
  // ----------------------------------------------------
  const { data: session, status } = useSession();
  const router = useRouter();

  // Derive flags used for access gating (pure computation, safe before returns)
  const role = session?.user?.role;
  const businessId = session?.user?.businessId || null;
  const hasPaid = !!session?.user?.hasPaid;

  // Memoized gate: who is allowed to see Billing UI?
  const allowBilling = useMemo(() => {
    if (!role) return false;

    if (role === "BUSINESS_OWNER" || role === "ADMIN") return true;

    if (role === "USER") {
      const isStaffSeatUser = !!businessId;
      if (isStaffSeatUser) return false; // staff-seat (role USER, tied to business) cannot see billing
      return hasPaid; // individual users must be paid to see billing
    }

    return false;
  }, [role, businessId, hasPaid]);

  // Local UI state (MUST be above any return)
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [purposeFilter, setPurposeFilter] = useState("ALL");
  const [userFilter, setUserFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Persisted filters (read once on mount)
  useEffect(() => {
    const storedPurpose = localStorage.getItem("billing:purposeFilter");
    const storedUser = localStorage.getItem("billing:userFilter");
    if (storedPurpose) setPurposeFilter(storedPurpose);
    if (storedUser) {
      setUserFilter(storedUser);
      setUserSearch(storedUser);
    }
  }, []);

  // Redirect users who are not allowed — only after session has resolved.
  useEffect(() => {
    if (status === "loading") return;
    if (!allowBilling) {
      router.replace("/dashboard");
    }
  }, [status, allowBilling, router]);

  // Fetch helper (no hooks inside; safe to define here)
  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (purposeFilter !== "ALL") params.set("purpose", purposeFilter);
      if (userFilter) params.set("user", userFilter);

      const res = await fetch(`/api/payments/history?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to load payments");

      setPayments(data.payments || []);
      setUsers(data.users || []);
      setError("");
    } catch (err: any) {
      console.error("[BillingPage] Error fetching payments:", err);
      setError(err?.message || "Internal error");
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when filters change — but only when:
  // - session is authenticated
  // - and the user is allowed to view billing
  useEffect(() => {
    // Save filters for next visit
    localStorage.setItem("billing:purposeFilter", purposeFilter);
    localStorage.setItem("billing:userFilter", userFilter);

    if (status !== "authenticated") return;
    if (!allowBilling) return;

    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purposeFilter, userFilter, status, allowBilling]);

  // Derived suggestion list (pure computation)
  const filteredSuggestions = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase()))
  );

  // CSV export (pure UI helper)
  const exportCSV = () => {
    const headers = [
      "User",
      "Email",
      "Role",
      "Description",
      "Purpose",
      "Amount",
      "Currency",
      "Date",
    ];

    const rows = payments.map((p) => [
      p.user?.name || "Unnamed",
      p.user?.email || "",
      p.user?.role || "N/A",
      p.description,
      p.purpose,
      p.amount,
      p.currency.toUpperCase(),
      new Date(p.createdAt).toLocaleString(),
    ]);

    const csvContent =
      [headers, ...rows].map((row) => row.map(String).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payments_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  // 2) Now it’s safe to conditionally return UI
  // -------------------------------------------
  // We kept your UX: while session is loading OR user can’t access, show a simple screen.
  if (status === "loading" || !allowBilling) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Loading billing...</p>
      </section>
    );
  }

  // 3) Main UI (unchanged except for comments)
  // ------------------------------------------
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
        Billing & Payment History
      </h1>

      {/* Filters + Export */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 relative">
        {/* Purpose Filter */}
        <select
          value={purposeFilter}
          onChange={(e) => setPurposeFilter(e.target.value)}
          className="px-3 py-2 rounded bg-white text-gray-800 text-sm shadow cursor-pointer"
        >
          <option value="ALL">All Purposes</option>
          <option value="PACKAGE">Packages</option>
          <option value="STAFF_SEAT">Staff Seats</option>
        </select>

        {/* User Search (only shown if server provided a user list) */}
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

        {/* CSV Export Button */}
        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-white text-sm font-bold rounded shadow cursor-pointer"
        >
          Export CSV
        </button>
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
                      <span className="text-xs text-gray-500">
                        {p.user.email}
                      </span>
                      <br />
                      <span className="text-xs text-gray-400">
                        ({p.user.role})
                      </span>
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

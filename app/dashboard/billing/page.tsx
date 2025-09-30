// app/dashboard/billing/page.tsx
//
// Purpose:
// - Billing dashboard with payments table + filters + CSV export.
// - Export includes Purpose (PACKAGE vs STAFF_SEAT) and Role (USER/ADMIN/BUSINESS_OWNER).
//
// IMPORTANT ACCESS RULES:
// - Allow: BUSINESS_OWNER, ADMIN
// - Allow: USER who purchased individually (hasPaid = true AND businessId is null)
// - Deny: USER staff-seat (businessId != null) → redirect back to /dashboard
//
// Why guard the page (not just the nav)?
// - Users can type /dashboard/billing manually. This guard ensures they still can’t access it.
// - Navbar remains a convenience, but page-level checks enforce security.

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
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
    role: string; // USER | ADMIN | BUSINESS_OWNER
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
  // ------------------------------
  // 1) Session + access gate
  // ------------------------------
  const { data: session, status } = useSession();
  const router = useRouter();

  // Compute access based on role + ownership vs staff seat
  const role = session?.user?.role;
  const businessId = session?.user?.businessId || null;
  const hasPaid = !!session?.user?.hasPaid;

  const allowBilling = useMemo(() => {
    if (!role) return false;

    // BUSINESS_OWNER or ADMIN → always allowed
    if (role === "BUSINESS_OWNER" || role === "ADMIN") return true;

    // USER:
    // - If staff-seat: role USER + businessId != null → deny
    // - If individual user: businessId == null → allowed only if hasPaid
    if (role === "USER") {
      const isStaffSeatUser = !!businessId;
      if (isStaffSeatUser) return false;
      return hasPaid; // individual users must be paid to see billing
    }

    return false;
  }, [role, businessId, hasPaid]);

  // Redirect away if not allowed (once session is ready)
  useEffect(() => {
    if (status === "loading") return;
    if (!allowBilling) {
      router.replace("/dashboard"); // silently go back to dashboard
    }
  }, [status, allowBilling, router]);

  // While loading session or redirecting
  if (status === "loading" || !allowBilling) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Loading billing...</p>
      </section>
    );
  }

  // ------------------------------
  // 2) Billing table + filters + CSV
  // ------------------------------
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [purposeFilter, setPurposeFilter] = useState("ALL");
  const [userFilter, setUserFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const storedPurpose = localStorage.getItem("billing:purposeFilter");
    const storedUser = localStorage.getItem("billing:userFilter");
    if (storedPurpose) setPurposeFilter(storedPurpose);
    if (storedUser) {
      setUserFilter(storedUser);
      setUserSearch(storedUser);
    }
  }, []);

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
    } catch (err: any) {
      console.error("[BillingPage] Error fetching payments:", err);
      setError(err.message || "Internal error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    localStorage.setItem("billing:purposeFilter", purposeFilter);
    localStorage.setItem("billing:userFilter", userFilter);
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purposeFilter, userFilter]);

  const filteredSuggestions = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const exportCSV = () => {
    // Add "Role" + "Purpose" to headers
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

    // Rows reflect the headers order
    const rows = payments.map((p) => [
      p.user?.name || "Unnamed",
      p.user?.email || "",
      p.user?.role || "N/A",
      p.description,
      p.purpose, // "PACKAGE" or "STAFF_SEAT"
      p.amount,
      p.currency.toUpperCase(),
      new Date(p.createdAt).toLocaleString(),
    ]);

    // Build CSV
    const csvContent =
      [headers, ...rows].map((row) => row.map(String).join(",")).join("\n");

    // Trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payments_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  // ------------------------------
  // Final Render
  // ------------------------------
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

        {/* User Search */}
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

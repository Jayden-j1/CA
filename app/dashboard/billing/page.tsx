// app/dashboard/billing/page.tsx
//
// Purpose
// -------
// Billing UI. For STAFF_SEAT rows, if description includes a beneficiary
// "Staff Seat for {NameOrEmail} <email> (ROLE)", show that staff member in
// the "User" column; otherwise show the payer (existing behavior).

"use client";

import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { usePaidAccess } from "@/hooks/usePaidAccess";

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

// Parse "Staff Seat for {Name} <email> (ROLE)" → { name, email, role }
function parseStaffBeneficiary(desc: string | undefined) {
  if (!desc) return null;
  const m = desc.match(/Staff Seat for (.+?) <([^>]+)>\s*\(([^)]+)\)/i);
  if (!m) return null;
  const name = m[1]?.trim() || null;
  const email = m[2]?.trim() || "";
  const role = m[3]?.trim() || "USER";
  if (!email) return null;
  return { name, email, role };
}

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

function BillingPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const access = usePaidAccess();

  const role = session?.user?.role;
  const businessId = session?.user?.businessId || null;

  const allowBilling = useMemo(() => {
    if (!role) return false;
    if (role === "BUSINESS_OWNER" || role === "ADMIN") return true;
    if (role === "USER") {
      const isStaff = !!businessId;
      if (isStaff) return false;
      return access.hasAccess === true;
    }
    return false;
  }, [role, businessId, access.hasAccess]);

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

  useEffect(() => {
    if (status === "loading") return;
    if (access.loading) return;
    if (!allowBilling) router.replace("/dashboard");
  }, [status, access.loading, allowBilling, router]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (purposeFilter !== "ALL") params.set("purpose", purposeFilter);
      if (userFilter) params.set("user", userFilter);

      const res = await fetch(`/api/payments/history?${params.toString()}`, {
        cache: "no-store",
      });
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

  useEffect(() => {
    localStorage.setItem("billing:purposeFilter", purposeFilter);
    localStorage.setItem("billing:userFilter", userFilter);
    if (status !== "authenticated") return;
    if (access.loading) return;
    if (!allowBilling) return;
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purposeFilter, userFilter, status, allowBilling, access.loading]);

  const filteredSuggestions = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const exportCSV = () => {
    const headers = ["User", "Email", "Role", "Description", "Purpose", "Amount", "Currency", "Date"];
    const rows = payments.map((p) => {
      const ben = p.purpose === "STAFF_SEAT" ? parseStaffBeneficiary(p.description) : null;
      const name = ben?.name || p.user?.name || "Unnamed";
      const email = ben?.email || p.user?.email || "";
      const role = ben?.role || p.user?.role || "N/A";
      return [name, email, role, p.description, p.purpose, p.amount, p.currency.toUpperCase(), new Date(p.createdAt).toLocaleString()];
    });
    const csv = [headers, ...rows].map((r) => r.map(String).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (status === "loading" || access.loading) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Loading billing…</p>
      </section>
    );
  }

  if (!allowBilling) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Redirecting…</p>
      </section>
    );
  }

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">Billing & Payment History</h1>

      {/* Filters + Export */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 relative">
        <select
          value={purposeFilter}
          onChange={(e) => setPurposeFilter(e.target.value)}
          className="px-3 py-2 rounded bg-white text-gray-800 text-sm shadow cursor-pointer"
        >
          <option value="ALL">All Purposes</option>
          <option value="PACKAGE">Packages</option>
          <option value="STAFF_SEAT">Staff Seats</option>
        </select>

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

        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-white text-sm font-bold rounded shadow cursor-pointer"
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
                <th className="py-2 px-3">User</th>
                <th className="py-2 px-3">Description</th>
                <th className="py-2 px-3">Purpose</th>
                <th className="py-2 px-3">Amount</th>
                <th className="py-2 px-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const ben = p.purpose === "STAFF_SEAT" ? parseStaffBeneficiary(p.description) : null;
                const displayName = ben?.name || p.user?.name || "Unnamed";
                const displayEmail = ben?.email || p.user?.email || "";
                const displayRole = ben?.role || p.user?.role || "N/A";

                return (
                  <tr key={p.id} className="border-b border-gray-200">
                    <td className="py-2 px-3 text-sm text-gray-700">
                      {displayName}
                      <br />
                      <span className="text-xs text-gray-500">{displayEmail}</span>
                      <br />
                      <span className="text-xs text-gray-400">({displayRole})</span>
                    </td>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

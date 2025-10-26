// app/dashboard/billing/page.tsx
//
// Purpose:
// - Billing dashboard that lists payments with simple filters and CSV export.
// - ✅ FIX 1: Clear a stale user filter when the signed-in user/owner changes.
// - ✅ FIX 2: If the saved user filter doesn’t exist in the returned "users" list,
//            auto-clear it to prevent an empty table with a bad filter.
// - ✅ Keep the existing /api/payments/check + role gating exactly as-is.
//
// Pillars:
// - Efficiency: changes are O(1), localStorage reads.
// - Robustness: prevents "empty results" due to stale filter after account switch.
// - Simplicity: localized effects; no API/DB changes.
// - Security: server remains source of truth via /api/payments/history guard.

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
  // 1) Session & fast access probe (do this BEFORE any conditional returns)
  const { data: session, status } = useSession();
  const router = useRouter();
  const access = usePaidAccess(); // { loading, hasAccess }

  const currentUserId = session?.user?.id || null;
  const role = session?.user?.role;
  const businessId = session?.user?.businessId || null;

  // Allow Billing?
  // - BUSINESS_OWNER / ADMIN → always
  // - USER staff-seat (businessId!=null) → never
  // - USER individual → only if access.hasAccess (probe ensures no lag)
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

  // Local UI state (declared before returns)
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [purposeFilter, setPurposeFilter] = useState("ALL");
  const [userFilter, setUserFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // ----------------------------------------------------------
  // FIX 1: Clear stale saved filters when the signed-in user changes
  // ----------------------------------------------------------
  useEffect(() => {
    if (!currentUserId) return;
    const lastOwnerId = localStorage.getItem("billing:lastOwnerId");
    if (lastOwnerId && lastOwnerId !== currentUserId) {
      // Owner changed → clear stale user filter so results aren’t empty.
      localStorage.removeItem("billing:userFilter");
      setUserFilter("");
      setUserSearch("");
    }
    localStorage.setItem("billing:lastOwnerId", currentUserId);
  }, [currentUserId]);

  // Persisted filters (initial load)
  useEffect(() => {
    const storedPurpose = localStorage.getItem("billing:purposeFilter");
    const storedUser = localStorage.getItem("billing:userFilter");
    if (storedPurpose) setPurposeFilter(storedPurpose);
    if (storedUser) {
      setUserFilter(storedUser);
      setUserSearch(storedUser);
    }
  }, []);

  // Redirect only AFTER session has resolved AND the access probe says no access.
  useEffect(() => {
    if (status === "loading") return;
    if (access.loading) return;
    if (!allowBilling) {
      router.replace("/dashboard");
    }
  }, [status, access.loading, allowBilling, router]);

  // Fetch helper
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

      // ----------------------------------------------------------
      // FIX 2: If the saved userFilter no longer exists in `users`,
      //        auto-clear it to avoid an empty list with a dead filter.
      // ----------------------------------------------------------
      if (userFilter && data.users) {
        const exists = data.users.some((u: UserOption) => u.email === userFilter);
        if (!exists) {
          setUserFilter("");
          setUserSearch("");
          localStorage.removeItem("billing:userFilter");
        }
      }
    } catch (err: any) {
      console.error("[BillingPage] Error fetching payments:", err);
      setError(err?.message || "Internal error");
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when filters change — but only when user is allowed and probe finished
  useEffect(() => {
    localStorage.setItem("billing:purposeFilter", purposeFilter);
    localStorage.setItem("billing:userFilter", userFilter);

    if (status !== "authenticated") return;
    if (access.loading) return;
    if (!allowBilling) return;

    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purposeFilter, userFilter, status, allowBilling, access.loading]);

  // Suggestions
  const filteredSuggestions = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase()))
  );

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

  // Early UI states:
  if (status === "loading" || access.loading) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Loading billing…</p>
      </section>
    );
  }

  if (!allowBilling) {
    // Router will redirect, but render a friendly state meanwhile.
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Redirecting…</p>
      </section>
    );
  }

  // Main UI
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
        Billing & Payment History
      </h1>

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

























// // app/dashboard/billing/page.tsx
// //
// // Purpose:
// // - Billing dashboard that lists payments with simple filters and CSV export.
// // - ✅ FIX: Use /api/payments/check fast-probe (with brief polling on success)
// //   to decide visibility, so Billing doesn’t bounce back to home while the
// //   NextAuth session is still catching up.
// //
// // Pillars:
// // - Efficiency: fetch only when allowed; state persisted via localStorage.
// // - Robustness: server-side rules remain enforced by /api/payments/history.
// // - Simplicity/ease of mgmt: minimal changes; preserves UX.
// // - Security: server is the source of truth (no client-side flips).

// "use client";

// import { Suspense } from "react";
// import { useEffect, useMemo, useState } from "react";
// import { useSession } from "next-auth/react";
// import { useRouter } from "next/navigation";
// import { usePaidAccess } from "@/hooks/usePaidAccess";

// interface PaymentRecord {
//   id: string;
//   amount: number;
//   currency: string;
//   description: string;
//   purpose: "PACKAGE" | "STAFF_SEAT";
//   createdAt: string;
//   user?: {
//     email: string;
//     name: string | null;
//     role: string;
//   };
// }

// interface UserOption {
//   email: string;
//   name: string | null;
// }

// function PurposeBadge({ purpose }: { purpose: string }) {
//   const style =
//     purpose === "STAFF_SEAT"
//       ? "bg-yellow-100 text-yellow-800"
//       : "bg-green-100 text-green-800";

//   return (
//     <span className={`${style} text-xs px-2 py-0.5 rounded font-semibold`}>
//       {purpose === "STAFF_SEAT" ? "Staff Seat" : "Package"}
//     </span>
//   );
// }

// export default function BillingPage() {
//   return (
//     <Suspense
//       fallback={
//         <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
//           <p className="text-white text-xl">Loading billing…</p>
//         </section>
//       }
//     >
//       <BillingPageInner />
//     </Suspense>
//   );
// }

// function BillingPageInner() {
//   // 1) Session & fast access probe (do this BEFORE any conditional returns)
//   const { data: session, status } = useSession();
//   const router = useRouter();
//   const access = usePaidAccess(); // { loading, hasAccess }

//   // User attributes
//   const role = session?.user?.role;
//   const businessId = session?.user?.businessId || null;

//   // Allow Billing?
//   // - BUSINESS_OWNER / ADMIN → always
//   // - USER staff-seat (businessId!=null) → never
//   // - USER individual → only if access.hasAccess (probe ensures no lag)
//   const allowBilling = useMemo(() => {
//     if (!role) return false;
//     if (role === "BUSINESS_OWNER" || role === "ADMIN") return true;
//     if (role === "USER") {
//       const isStaff = !!businessId;
//       if (isStaff) return false;
//       return access.hasAccess === true;
//     }
//     return false;
//   }, [role, businessId, access.hasAccess]);

//   // Local UI state (declared before returns)
//   const [payments, setPayments] = useState<PaymentRecord[]>([]);
//   const [users, setUsers] = useState<UserOption[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   const [purposeFilter, setPurposeFilter] = useState("ALL");
//   const [userFilter, setUserFilter] = useState("");
//   const [userSearch, setUserSearch] = useState("");
//   const [showSuggestions, setShowSuggestions] = useState(false);

//   // Persisted filters
//   useEffect(() => {
//     const storedPurpose = localStorage.getItem("billing:purposeFilter");
//     const storedUser = localStorage.getItem("billing:userFilter");
//     if (storedPurpose) setPurposeFilter(storedPurpose);
//     if (storedUser) {
//       setUserFilter(storedUser);
//       setUserSearch(storedUser);
//     }
//   }, []);

//   // Redirect only AFTER session has resolved AND the access probe says no access.
//   useEffect(() => {
//     if (status === "loading") return;
//     if (access.loading) return;
//     if (!allowBilling) {
//       router.replace("/dashboard");
//     }
//   }, [status, access.loading, allowBilling, router]);

//   // Fetch helper
//   const fetchPayments = async () => {
//     try {
//       setLoading(true);
//       const params = new URLSearchParams();
//       if (purposeFilter !== "ALL") params.set("purpose", purposeFilter);
//       if (userFilter) params.set("user", userFilter);

//       const res = await fetch(`/api/payments/history?${params.toString()}`, {
//         cache: "no-store",
//       });
//       const data = await res.json();

//       if (!res.ok) throw new Error(data.error || "Failed to load payments");

//       setPayments(data.payments || []);
//       setUsers(data.users || []);
//       setError("");
//     } catch (err: any) {
//       console.error("[BillingPage] Error fetching payments:", err);
//       setError(err?.message || "Internal error");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Re-fetch when filters change — but only when user is allowed and probe finished
//   useEffect(() => {
//     localStorage.setItem("billing:purposeFilter", purposeFilter);
//     localStorage.setItem("billing:userFilter", userFilter);

//     if (status !== "authenticated") return;
//     if (access.loading) return;
//     if (!allowBilling) return;

//     fetchPayments();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [purposeFilter, userFilter, status, allowBilling, access.loading]);

//   // Suggestions
//   const filteredSuggestions = users.filter(
//     (u) =>
//       u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
//       (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase()))
//   );

//   const exportCSV = () => {
//     const headers = [
//       "User",
//       "Email",
//       "Role",
//       "Description",
//       "Purpose",
//       "Amount",
//       "Currency",
//       "Date",
//     ];

//     const rows = payments.map((p) => [
//       p.user?.name || "Unnamed",
//       p.user?.email || "",
//       p.user?.role || "N/A",
//       p.description,
//       p.purpose,
//       p.amount,
//       p.currency.toUpperCase(),
//       new Date(p.createdAt).toLocaleString(),
//     ]);

//     const csvContent =
//       [headers, ...rows].map((row) => row.map(String).join(",")).join("\n");

//     const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
//     const url = URL.createObjectURL(blob);
//     const link = document.createElement("a");
//     link.href = url;
//     link.download = `payments_${new Date().toISOString().split("T")[0]}.csv`;
//     link.click();
//   };

//   // Early UI states:
//   if (status === "loading" || access.loading) {
//     return (
//       <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
//         <p className="text-white text-xl">Loading billing…</p>
//       </section>
//     );
//   }

//   if (!allowBilling) {
//     // Router will redirect, but render a friendly state meanwhile.
//     return (
//       <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
//         <p className="text-white text-xl">Redirecting…</p>
//       </section>
//     );
//   }

//   // Main UI
//   return (
//     <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
//       <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
//         Billing & Payment History
//       </h1>

//       {/* Filters + Export */}
//       <div className="flex flex-col sm:flex-row gap-4 mb-6 relative">
//         <select
//           value={purposeFilter}
//           onChange={(e) => setPurposeFilter(e.target.value)}
//           className="px-3 py-2 rounded bg-white text-gray-800 text-sm shadow cursor-pointer"
//         >
//           <option value="ALL">All Purposes</option>
//           <option value="PACKAGE">Packages</option>
//           <option value="STAFF_SEAT">Staff Seats</option>
//         </select>

//         {users.length > 0 && (
//           <div className="relative">
//             <input
//               type="text"
//               placeholder="Search user..."
//               value={userSearch}
//               onChange={(e) => {
//                 setUserSearch(e.target.value);
//                 setShowSuggestions(true);
//               }}
//               onFocus={() => setShowSuggestions(true)}
//               className="px-3 py-2 rounded bg-white text-gray-800 text-sm shadow w-64"
//             />

//             {showSuggestions && filteredSuggestions.length > 0 && (
//               <ul className="absolute z-10 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto w-full">
//                 <li
//                   onClick={() => {
//                     setUserFilter("");
//                     setUserSearch("");
//                     setShowSuggestions(false);
//                   }}
//                   className="px-3 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100"
//                 >
//                   All Users
//                 </li>
//                 {filteredSuggestions.map((u) => (
//                   <li
//                     key={u.email}
//                     onClick={() => {
//                       setUserFilter(u.email);
//                       setUserSearch(u.email);
//                       setShowSuggestions(false);
//                     }}
//                     className="px-3 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100"
//                   >
//                     {u.name || "Unnamed"} ({u.email})
//                   </li>
//                 ))}
//               </ul>
//             )}
//           </div>
//         )}

//         <button
//           onClick={exportCSV}
//           className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-white text-sm font-bold rounded shadow cursor-pointer"
//         >
//           Export CSV
//         </button>
//       </div>

//       {loading ? (
//         <p className="text-white">Loading payments...</p>
//       ) : error ? (
//         <p className="text-red-300">{error}</p>
//       ) : payments.length === 0 ? (
//         <p className="text-white">No payments found.</p>
//       ) : (
//         <div className="w-[90%] sm:w-[600px] md:w-[1000px] bg-white rounded-xl shadow-xl p-6 overflow-x-auto">
//           <h2 className="font-bold text-xl mb-4">Payment Records</h2>
//           <table className="w-full border-collapse">
//             <thead>
//               <tr className="text-left border-b border-gray-300">
//                 {payments[0]?.user && <th className="py-2 px-3">User</th>}
//                 <th className="py-2 px-3">Description</th>
//                 <th className="py-2 px-3">Purpose</th>
//                 <th className="py-2 px-3">Amount</th>
//                 <th className="py-2 px-3">Date</th>
//               </tr>
//             </thead>
//             <tbody>
//               {payments.map((p) => (
//                 <tr key={p.id} className="border-b border-gray-200">
//                   {p.user && (
//                     <td className="py-2 px-3 text-sm text-gray-700">
//                       {p.user.name || "Unnamed"} <br />
//                       <span className="text-xs text-gray-500">
//                         {p.user.email}
//                       </span>
//                       <br />
//                       <span className="text-xs text-gray-400">
//                         ({p.user.role})
//                       </span>
//                     </td>
//                   )}
//                   <td className="py-2 px-3">{p.description}</td>
//                   <td className="py-2 px-3">
//                     <PurposeBadge purpose={p.purpose} />
//                   </td>
//                   <td className="py-2 px-3 font-bold">
//                     ${p.amount} {p.currency.toUpperCase()}
//                   </td>
//                   <td className="py-2 px-3">
//                     {new Date(p.createdAt).toLocaleDateString()}
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       )}
//     </section>
//   );
// }

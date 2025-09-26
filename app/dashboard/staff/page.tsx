// app/dashboard/staff/page.tsx
//
// Purpose:
// - Staff management for BUSINESS_OWNER + ADMIN.
// - Features:
//   • Filter staff list (All / Admins / Users).
//   • Remove staff with confirmation + toast feedback.
//   • Promote/Demote staff roles (USER <-> ADMIN).
//   • Stripe success/cancel toasts after returning from checkout.
//
// Dependencies:
// - /api/staff/list → fetches staff with { id, name, email, role, createdAt }.
// - /api/staff/remove → removes staff, returns { removedEmail }.
// - /api/staff/update-role → updates role, returns updated user.
//
// Notes:
// - Staff = USER or ADMIN (BUSINESS_OWNER is excluded).
// - Query params from Stripe (?success / ?canceled / ?staff) are cleaned up after showing toasts.

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import RequireRole from "@/components/auth/requiredRole";

// Type-safe role definition
type Role = "USER" | "ADMIN";

// Shape of staff item from API
interface Staff {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

// ---------------------------------------------
// Small visual badge for staff roles
// ---------------------------------------------
function RoleBadge({ role }: { role: Role }) {
  const isAdmin = role === "ADMIN";
  const style =
    (isAdmin
      ? "bg-purple-100 text-purple-700"
      : "bg-gray-100 text-gray-700") +
    " text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide";
  return <span className={style}>{role}</span>;
}

// ---------------------------------------------
// Stripe redirect toast handler
// ---------------------------------------------
function StaffToastHandler({ onSuccess }: { onSuccess: () => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    const staffEmail = searchParams.get("staff");

    if (success) {
      toast.success(
        `🎉 Payment successful! ${
          staffEmail ? `${staffEmail} now has access.` : "Staff seat activated."
        }`,
        { duration: 6000 }
      );
      onSuccess(); // refresh list
      window.history.replaceState(null, "", window.location.pathname);
    }

    if (canceled) {
      toast.error(
        `❌ Payment canceled. ${
          staffEmail ? `${staffEmail} was not activated.` : ""
        }`,
        { duration: 6000 }
      );
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams, onSuccess]);

  return null;
}

// ---------------------------------------------
// Main content (filters, list, actions)
// ---------------------------------------------
function StaffDashboardContent() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter state: ALL | ADMIN | USER
  const [filter, setFilter] = useState<"ALL" | Role>("ALL");

  // -------------------------
  // Fetch staff from API
  // -------------------------
  const fetchStaff = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/staff/list");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to fetch staff");
      } else {
        setStaffList(data.staff);
      }
    } catch (err) {
      console.error("[StaffDashboard] Fetch error:", err);
      setError("Internal error");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // Remove staff (API + toast)
  // -------------------------
  const removeStaff = async (staffId: string, staffEmailFromUI: string) => {
    try {
      const res = await fetch("/api/staff/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error removing staff");
        return;
      }
      const email = data.removedEmail || staffEmailFromUI;
      toast.success(`✅ Removed staff: ${email}`, { duration: 4000 });
      fetchStaff();
      window.history.replaceState(null, "", window.location.pathname);
    } catch (err) {
      console.error("[StaffDashboard] Remove error:", err);
      toast.error("Internal error removing staff");
    }
  };

  // -------------------------
  // Confirmation before remove
  // -------------------------
  const confirmRemoveStaff = (staffId: string, staffEmail: string) => {
    toast.custom(
      (t) => (
        <div className="bg-white shadow-md rounded-lg p-4 flex flex-col gap-3 text-center w-[280px]">
          <p className="font-semibold text-gray-800">
            Remove <span className="text-red-600">{staffEmail}</span>?
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => {
                toast.dismiss(t.id);
                removeStaff(staffId, staffEmail);
              }}
              className="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700"
            >
              Yes
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="bg-gray-300 text-gray-800 px-4 py-1 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ),
      { duration: 5000 }
    );
  };

  // -------------------------
  // Promote/Demote role
  // -------------------------
  const updateRole = async (staffId: string, nextRole: Role) => {
    try {
      const res = await fetch("/api/staff/update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, newRole: nextRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Unable to change role");
        return;
      }
      const email = data.user?.email || "user";
      toast.success(`✅ ${email} is now ${data.user?.role}`, { duration: 4000 });
      fetchStaff();
    } catch (err) {
      console.error("[StaffDashboard] update-role error:", err);
      toast.error("Internal error updating role");
    }
  };

  // -------------------------
  // Apply filter
  // -------------------------
  const visibleStaff = useMemo(() => {
    if (filter === "ALL") return staffList;
    return staffList.filter((s) => s.role === filter);
  }, [staffList, filter]);

  // Initial load
  useEffect(() => {
    fetchStaff();
  }, []);

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center gap-12">
      {/* Stripe toasts */}
      <StaffToastHandler onSuccess={fetchStaff} />

      {/* Heading */}
      <h1 className="text-white font-bold text-4xl sm:text-5xl text-center">
        Staff Management
      </h1>

      {/* Filter controls */}
      <div className="flex gap-2">
        {["ALL", "ADMIN", "USER"].map((f) => (
          <button
            key={f}
            className={`px-3 py-1 rounded text-sm font-bold cursor-pointer ${
              filter === f
                ? "bg-white text-blue-600"
                : "bg-white/70 text-blue-900"
            }`}
            onClick={() => setFilter(f as "ALL" | Role)}
          >
            {f === "ALL" ? "All" : f === "ADMIN" ? "Admins" : "Users"}
          </button>
        ))}
      </div>

      {/* Staff List */}
      <div className="w-[90%] sm:w-[600px] md:w-[900px] bg-white rounded-xl p-6 shadow-xl">
        <h2 className="font-bold text-xl mb-4">Current Staff</h2>

        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : visibleStaff.length === 0 ? (
          <p>No staff found for this filter.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {visibleStaff.map((staff) => {
              const isAdmin = staff.role === "ADMIN";
              const nextRole: Role = isAdmin ? "USER" : "ADMIN";
              return (
                <li
                  key={staff.id}
                  className="py-3 flex justify-between items-center"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <span className="font-medium">{staff.name}</span>
                    <span className="text-gray-500">{staff.email}</span>
                    <RoleBadge role={staff.role} />
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Promote/Demote */}
                    <button
                      onClick={() => updateRole(staff.id, nextRole)}
                      className={`px-3 py-1 rounded text-xs font-bold ${
                        isAdmin
                          ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                          : "bg-green-100 text-green-800 hover:bg-green-200"
                      }`}
                      title={isAdmin ? "Demote to USER" : "Promote to ADMIN"}
                    >
                      {isAdmin ? "Demote to USER" : "Promote to ADMIN"}
                    </button>

                    {/* Remove */}
                    <button
                      onClick={() => confirmRemoveStaff(staff.id, staff.email)}
                      className="text-red-600 hover:text-red-800 font-bold text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------
// Route guard: only BUSINESS_OWNER + ADMIN
// ---------------------------------------------
export default function StaffDashboardPage() {
  return (
    <RequireRole allowed={["BUSINESS_OWNER", "ADMIN"]}>
      <StaffDashboardContent />
    </RequireRole>
  );
}









// // app/dashboard/staff/page.tsx
// //
// // Purpose:
// // - Staff management for BUSINESS_OWNER + ADMIN.
// // - Displays current staff list with a "Remove" action.
// // - Shows Stripe success/cancel toasts after returning from checkout.
// // - Confirms removal with a custom toast before calling the API.
// //
// // Key bits to note:
// // - Uses /api/staff/list to fetch staff (must return id/name/email/createdAt; role optional).
// // - Uses /api/staff/remove for removal (your route now returns { removedEmail }).
// // - Cleans query params after toasts so refresh won’t retrigger.

// "use client";

// import { useEffect, useState } from "react";
// import { useSearchParams } from "next/navigation";
// import toast from "react-hot-toast";
// import RequireRole from "@/components/auth/requiredRole";

// // Shape of a staff row (role is optional; if your API returns it, we’ll show it)
// interface Staff {
//   id: string;
//   name: string;
//   email: string;
//   createdAt: string;
//   role?: "USER" | "ADMIN";
// }

// // -------------------------------------------------------
// // Stripe redirect toast handler
// // -------------------------------------------------------
// function StaffToastHandler({ onSuccess }: { onSuccess: () => void }) {
//   const searchParams = useSearchParams();

//   useEffect(() => {
//     const success = searchParams.get("success");
//     const canceled = searchParams.get("canceled");
//     const staffEmail = searchParams.get("staff");

//     if (success) {
//       toast.success(
//         `🎉 Payment successful! ${
//           staffEmail ? `${staffEmail} now has access.` : "Staff seat activated."
//         }`,
//         { duration: 6000 }
//       );
//       // Refresh list + clean query string
//       onSuccess();
//       window.history.replaceState(null, "", window.location.pathname);
//     }

//     if (canceled) {
//       toast.error(
//         `❌ Payment canceled. ${
//           staffEmail ? `${staffEmail} was not activated.` : ""
//         }`,
//         { duration: 6000 }
//       );
//       // Clean query string
//       window.history.replaceState(null, "", window.location.pathname);
//     }
//   }, [searchParams, onSuccess]);

//   return null;
// }

// // -------------------------------------------------------
// // Main content
// // -------------------------------------------------------
// function StaffDashboardContent() {
//   const [staffList, setStaffList] = useState<Staff[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   // Fetch current staff
//   const fetchStaff = async () => {
//     setLoading(true);
//     setError("");
//     try {
//       const res = await fetch("/api/staff/list");
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || "Failed to fetch staff");
//       setStaffList(data.staff);
//     } catch (err) {
//       console.error("[StaffDashboard] Fetch error:", err);
//       setError("Internal error");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Call removal API with confirmation toast
//   const confirmRemoveStaff = (staffId: string, staffEmail: string) => {
//     toast.custom(
//       (t) => (
//         <div className="bg-white shadow-md rounded-lg p-4 flex flex-col gap-3 text-center w-[280px]">
//           <p className="font-semibold text-gray-800">
//             Remove <span className="text-red-600">{staffEmail}</span>?
//           </p>
//           <div className="flex justify-center gap-4">
//             <button
//               onClick={() => {
//                 toast.dismiss(t.id); // close confirmation toast
//                 removeStaff(staffId);
//               }}
//               className="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700"
//             >
//               Yes
//             </button>
//             <button
//               onClick={() => toast.dismiss(t.id)}
//               className="bg-gray-300 text-gray-800 px-4 py-1 rounded hover:bg-gray-400"
//             >
//               Cancel
//             </button>
//           </div>
//         </div>
//       ),
//       { duration: 5000 } // auto-dismiss if no action
//     );
//   };

//   // Removal — calls POST /api/staff/remove and expects { removedEmail }
//   const removeStaff = async (staffId: string) => {
//     try {
//       const res = await fetch("/api/staff/remove", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ staffId }),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         toast.error(data.error || "Error removing staff");
//         return;
//       }
//       // ✅ Toast with the exact email returned from the API
//       toast.success(`✅ Removed staff: ${data.removedEmail}`, { duration: 4000 });

//       // Refresh list and clean any lingering query params
//       fetchStaff();
//       window.history.replaceState(null, "", window.location.pathname);
//     } catch (err) {
//       console.error("[StaffDashboard] Remove error:", err);
//       toast.error("Internal error removing staff");
//     }
//   };

//   // Initial fetch
//   useEffect(() => {
//     fetchStaff();
//   }, []);

//   return (
//     <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center gap-12">
//       {/* Suspense-safe, lightweight toast effects for Stripe redirects */}
//       <StaffToastHandler onSuccess={fetchStaff} />

//       <h1 className="text-white font-bold text-4xl sm:text-5xl text-center">
//         Staff Management
//       </h1>

//       {/* Staff table */}
//       <div className="w-[90%] sm:w-[600px] md:w-[800px] bg-white rounded-xl p-6 shadow-xl">
//         <h2 className="font-bold text-xl mb-4">Current Staff</h2>

//         {loading ? (
//           <p>Loading...</p>
//         ) : error ? (
//           <p className="text-red-500">{error}</p>
//         ) : staffList.length === 0 ? (
//           <p>No staff added yet.</p>
//         ) : (
//           <ul className="divide-y divide-gray-200">
//             {staffList.map((staff) => (
//               <li
//                 key={staff.id}
//                 className="py-2 flex justify-between items-center"
//               >
//                 <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
//                   <span className="font-medium">{staff.name}</span>
//                   <span className="text-gray-500">{staff.email}</span>
//                   {/* Show role only if API returns it; default to USER for display */}
//                   <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
//                     {staff.role ?? "USER"}
//                   </span>
//                 </div>

//                 <button
//                   onClick={() => confirmRemoveStaff(staff.id, staff.email)}
//                   className="text-red-600 hover:text-red-800 font-bold text-sm"
//                 >
//                   Remove
//                 </button>
//               </li>
//             ))}
//           </ul>
//         )}
//       </div>
//     </section>
//   );
// }

// // ---------------------------------------------
// // Route guard: BUSINESS_OWNER + ADMIN only
// // ---------------------------------------------
// export default function StaffDashboardPage() {
//   return (
//     <RequireRole allowed={["BUSINESS_OWNER", "ADMIN"]}>
//       <StaffDashboardContent />
//     </RequireRole>
//   );
// }









// // app/dashboard/staff/page.tsx
// //
// // Purpose:
// // - Staff management page (BUSINESS_OWNER + ADMIN).
// // - Shows current staff list with roles, Remove buttons, and Promote/Demote actions.
// // - Adds client-side filters: All / Admins / Users.
// // - Keeps Stripe success/cancel toasts via <SearchParamsWrapper>.
// //
// // Notes:
// // - We removed the embedded AddStaffForm here to keep this page focused on list/management.
// //   (Add staff from /dashboard/add-staff.)
// // - Promote/Demote calls /api/staff/update-role and refreshes the list.

// "use client";

// import { useEffect, useMemo, useState } from "react";
// import { useSearchParams } from "next/navigation";
// import toast from "react-hot-toast";
// import RequireRole from "@/components/auth/requiredRole";
// import SearchParamsWrapper from "@/components/utils/searchParamsWrapper";

// type Role = "USER" | "ADMIN";

// interface Staff {
//   id: string;
//   name: string;
//   email: string;
//   role: Role;
//   createdAt: string;
// }

// // Small role badge
// function RoleBadge({ role }: { role: Role }) {
//   const isAdmin = role === "ADMIN";
//   const style =
//     (isAdmin
//       ? "bg-purple-100 text-purple-700"
//       : "bg-gray-100 text-gray-700") +
//     " text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide";
//   return <span className={style}>{role}</span>;
// }

// // Stripe success/cancel toast handler (unchanged)
// function StaffToastHandler({ onSuccess }: { onSuccess: () => void }) {
//   const searchParams = useSearchParams();
//   useEffect(() => {
//     const success = searchParams.get("success");
//     const canceled = searchParams.get("canceled");
//     const staffEmail = searchParams.get("staff");

//     if (success) {
//       toast.success(
//         `🎉 Payment successful! ${
//           staffEmail ? `${staffEmail} now has access.` : "Staff seat activated."
//         }`,
//         { duration: 6000 }
//       );
//       onSuccess();
//       window.history.replaceState(null, "", window.location.pathname);
//     }

//     if (canceled) {
//       toast.error(
//         `❌ Payment canceled. ${staffEmail ? `${staffEmail} was not activated.` : ""}`,
//         { duration: 6000 }
//       );
//       window.history.replaceState(null, "", window.location.pathname);
//     }
//   }, [searchParams, onSuccess]);

//   return null;
// }

// function StaffDashboardContent() {
//   const [staffList, setStaffList] = useState<Staff[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   // Filter state: ALL | ADMIN | USER
//   const [filter, setFilter] = useState<"ALL" | Role>("ALL");

//   // Fetch staff
//   const fetchStaff = async () => {
//     setLoading(true);
//     setError("");
//     try {
//       // Client-side filter; we still fetch all so changing filter is instant.
//       const res = await fetch("/api/staff/list");
//       const data = await res.json();
//       if (!res.ok) {
//         setError(data.error || "Failed to fetch staff");
//       } else {
//         setStaffList(data.staff);
//       }
//     } catch (err) {
//       console.error("[Staff] Fetch error:", err);
//       setError("Internal error");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Remove staff (calls existing API with confirmation toast flow elsewhere)
//   const removeStaff = async (staffId: string, staffEmailFromUI: string) => {
//     try {
//       const res = await fetch("/api/staff/remove", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ staffId }),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         toast.error(data.error || "Error removing staff");
//         return;
//       }
//       const email = data.removedEmail || staffEmailFromUI;
//       toast.success(`✅ Removed staff: ${email}`, { duration: 4000 });
//       fetchStaff();
//       window.history.replaceState(null, "", window.location.pathname);
//     } catch (err) {
//       console.error("[Staff] Remove error:", err);
//       toast.error("Internal error removing staff");
//     }
//   };

//   // Confirmation toast before remove
//   const confirmRemoveStaff = (staffId: string, staffEmail: string) => {
//     toast.custom(
//       (t) => (
//         <div className="bg-white shadow-md rounded-lg p-4 flex flex-col gap-3 text-center w-[280px]">
//           <p className="font-semibold text-gray-800">
//             Remove <span className="text-red-600">{staffEmail}</span>?
//           </p>
//           <div className="flex justify-center gap-4">
//             <button
//               onClick={() => {
//                 toast.dismiss(t.id);
//                 removeStaff(staffId, staffEmail);
//               }}
//               className="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700"
//             >
//               Yes
//             </button>
//             <button
//               onClick={() => toast.dismiss(t.id)}
//               className="bg-gray-300 text-gray-800 px-4 py-1 rounded hover:bg-gray-400"
//             >
//               Cancel
//             </button>
//           </div>
//         </div>
//       ),
//       { duration: 5000 }
//     );
//   };

//   // Promote/Demote API call
//   const updateRole = async (staffId: string, nextRole: Role) => {
//     try {
//       const res = await fetch("/api/staff/update-role", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ staffId, newRole: nextRole }),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         toast.error(data.error || "Unable to change role");
//         return;
//       }
//       const email = data.user?.email || "user";
//       toast.success(`✅ ${email} is now ${data.user?.role}`, { duration: 4000 });
//       fetchStaff();
//     } catch (err) {
//       console.error("[Staff] update-role error:", err);
//       toast.error("Internal error updating role");
//     }
//   };

//   // Computed list based on filter
//   const visibleStaff = useMemo(() => {
//     if (filter === "ALL") return staffList;
//     return staffList.filter((s) => s.role === filter);
//   }, [staffList, filter]);

//   // Initial load
//   useEffect(() => {
//     fetchStaff();
//   }, []);

//   return (
//     <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center gap-12">
//       {/* Stripe success/cancel toasts */}
//       <SearchParamsWrapper>
//         <StaffToastHandler onSuccess={fetchStaff} />
//       </SearchParamsWrapper>

//       {/* Heading */}
//       <h1 className="text-white font-bold text-4xl sm:text-5xl text-center">
//         Staff Management
//       </h1>

//       {/* Filter controls */}
//       <div className="flex gap-2">
//         <button
//           className={`px-3 py-1 rounded text-sm font-bold cursor-pointer ${
//             filter === "ALL" ? "bg-white text-blue-600" : "bg-white/70 text-blue-900"
//           }`}
//           onClick={() => setFilter("ALL")}
//         >
//           All
//         </button>
//         <button
//           className={`px-3 py-1 rounded text-sm font-bold cursor-pointer ${
//             filter === "ADMIN" ? "bg-white text-blue-600" : "bg-white/70 text-blue-900"
//           }`}
//           onClick={() => setFilter("ADMIN")}
//         >
//           Admins
//         </button>
//         <button
//           className={`px-3 py-1 rounded text-sm font-bold cursor-pointer ${
//             filter === "USER" ? "bg-white text-blue-600" : "bg-white/70 text-blue-900"
//           }`}
//           onClick={() => setFilter("USER")}
//         >
//           Users
//         </button>
//       </div>

//       {/* Staff List */}
//       <div className="w-[90%] sm:w-[600px] md:w-[900px] bg-white rounded-xl p-6 shadow-xl">
//         <h2 className="font-bold text-xl mb-4">Current Staff</h2>

//         {loading ? (
//           <p>Loading...</p>
//         ) : error ? (
//           <p className="text-red-500">{error}</p>
//         ) : visibleStaff.length === 0 ? (
//           <p>No staff found for this filter.</p>
//         ) : (
//           <ul className="divide-y divide-gray-200">
//             {visibleStaff.map((staff) => {
//               const isAdmin = staff.role === "ADMIN";
//               const nextRole: Role = isAdmin ? "USER" : "ADMIN";
//               return (
//                 <li key={staff.id} className="py-3 flex justify-between items-center">
//                   <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
//                     <span className="font-medium">{staff.name}</span>
//                     <span className="text-gray-500">{staff.email}</span>
//                     <RoleBadge role={staff.role} />
//                   </div>

//                   <div className="flex items-center gap-3">
//                     {/* Promote/Demote */}
//                     <button
//                       onClick={() => updateRole(staff.id, nextRole)}
//                       className={`px-3 py-1 rounded text-xs font-bold ${
//                         isAdmin
//                           ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" // demote to USER
//                           : "bg-green-100 text-green-800 hover:bg-green-200" // promote to ADMIN
//                       }`}
//                       title={isAdmin ? "Demote to USER" : "Promote to ADMIN"}
//                     >
//                       {isAdmin ? "Demote to USER" : "Promote to ADMIN"}
//                     </button>

//                     {/* Remove (with confirm) */}
//                     <button
//                       onClick={() => confirmRemoveStaff(staff.id, staff.email)}
//                       className="text-red-600 hover:text-red-800 font-bold text-sm"
//                     >
//                       Remove
//                     </button>
//                   </div>
//                 </li>
//               );
//             })}
//           </ul>
//         )}
//       </div>

//       {/* NOTE: No add form here; add staff from /dashboard/add-staff */}
//     </section>
//   );
// }

// export default function StaffDashboardPage() {
//   return (
//     <RequireRole allowed={["BUSINESS_OWNER", "ADMIN"]}>
//       <StaffDashboardContent />
//     </RequireRole>
//   );
// }

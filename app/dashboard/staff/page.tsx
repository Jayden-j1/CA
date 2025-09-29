// app/dashboard/staff/page.tsx
//
// Purpose:
// - Staff management for BUSINESS_OWNER + ADMIN.
// - Features:
//   • Filter staff list (All / Admins / Users).
//   • Remove staff (soft delete → instantly hide via optimistic update).
//   • Promote/Demote staff roles.
//   • Stripe success/cancel toasts.
//
// 🚩 Updated:
// - Optimistic removal: API now returns { removedId } so UI updates instantly
//   without waiting for re-fetch.
// - Still calls fetchStaff afterward for safety sync.

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import RequireRole from "@/components/auth/requiredRole";

type Role = "USER" | "ADMIN";

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
        { duration: 2000 }
      );
      onSuccess(); // refresh list
      window.history.replaceState(null, "", window.location.pathname);
    }

    if (canceled) {
      toast.error(
        `❌ Payment canceled. ${
          staffEmail ? `${staffEmail} was not activated.` : ""
        }`,
        { duration: 2000 }
      );
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams, onSuccess]);

  return null;
}

// ---------------------------------------------
// Main Staff Dashboard
// ---------------------------------------------
function StaffDashboardContent() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"ALL" | Role>("ALL");

  // -------------------------
  // Fetch staff
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
  // Remove staff (optimistic update + API)
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

      // ✅ Optimistically update UI
      setStaffList((prev) => prev.filter((s) => s.id !== data.removedId));
      const email = data.removedEmail || staffEmailFromUI;
      toast.success(`✅ Removed staff: ${email}`, { duration: 4000 });

      // Sync with backend
      fetchStaff();
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
      <StaffToastHandler onSuccess={fetchStaff} />

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
                : "hover:bg-white bg-white/70 text-blue-900"
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
                    <button
                      onClick={() => updateRole(staff.id, nextRole)}
                      className={`px-3 py-1 rounded text-xs font-bold cursor-pointer ${
                        isAdmin
                          ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                          : "bg-green-100 text-green-800 hover:bg-green-200"
                      }`}
                    >
                      {isAdmin ? "Demote to USER" : "Promote to ADMIN"}
                    </button>

                    <button
                      onClick={() => confirmRemoveStaff(staff.id, staff.email)}
                      className="text-red-600 hover:text-red-800 font-bold text-sm cursor-pointer"
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

// Guard
export default function StaffDashboardPage() {
  return (
    <RequireRole allowed={["BUSINESS_OWNER", "ADMIN"]}>
      <StaffDashboardContent />
    </RequireRole>
  );
}

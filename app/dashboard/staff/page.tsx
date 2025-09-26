// app/dashboard/staff/page.tsx
//
// Purpose:
// - Staff management dashboard (BUSINESS_OWNER + ADMIN).
// - Shows current staff list with roles (USER / ADMIN) + Remove buttons.
// - Keeps Stripe success/cancel toasts and removal confirmation.
//
// Change in this version:
// - Include `role` in Staff interface.
// - Render a small role badge next to the staff email.
// - When removing, prefer the API-returned email (safer than client copy).

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import AddStaffForm from "@/components/forms/addStaffForm";
import RequireRole from "@/components/auth/requiredRole";
import SearchParamsWrapper from "@/components/utils/searchParamsWrapper";

// ------------------------------
// Staff Type (matches API /api/staff/list)
// ------------------------------
interface Staff {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN"; // ✅ NEW: include role
  createdAt: string;
}

// Simple helper to style a role badge
function RoleBadge({ role }: { role: Staff["role"] }) {
  const isAdmin = role === "ADMIN";
  const style =
    (isAdmin
      ? "bg-purple-100 text-purple-700"
      : "bg-gray-100 text-gray-700") +
    " text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide";
  return <span className={style}>{role}</span>;
}

// ------------------------------
// StaffToastHandler
// ------------------------------
// Handles toasts for Stripe redirect (?success / ?canceled).
// Cleans query params to prevent repeats on refresh.
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
      onSuccess();
      window.history.replaceState(null, "", window.location.pathname);
    }

    if (canceled) {
      toast.error(
        `❌ Payment canceled. ${staffEmail ? `${staffEmail} was not activated.` : ""}`,
        { duration: 6000 }
      );
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams, onSuccess]);

  return null;
}

// ------------------------------
// StaffDashboardContent
// ------------------------------
function StaffDashboardContent() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ✅ Fetch staff list from API
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

  // ✅ Remove staff via API (hard delete)
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

      // Prefer email returned by API (truth source) over UI copy
      const email = data.removedEmail || staffEmailFromUI;
      toast.success(`✅ Removed staff: ${email}`, { duration: 4000 });
      fetchStaff();

      // Clean up any accidental query flags (consistency with other flows)
      window.history.replaceState(null, "", window.location.pathname);
    } catch (err) {
      console.error("[StaffDashboard] Remove error:", err);
      toast.error("Internal error removing staff");
    }
  };

  // ✅ Show confirmation toast before removal
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

  // Fetch staff on first mount
  useEffect(() => {
    fetchStaff();
  }, []);

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center gap-12">
      {/* ✅ Toast handler for Stripe redirects, Suspense-safe */}
      <SearchParamsWrapper>
        <StaffToastHandler onSuccess={fetchStaff} />
      </SearchParamsWrapper>

      {/* Heading */}
      <h1 className="text-white font-bold text-4xl sm:text-5xl text-center">
        Staff Management
      </h1>

      {/* Staff List */}
      <div className="w-[90%] sm:w-[600px] md:w-[800px] bg-white rounded-xl p-6 shadow-xl">
        <h2 className="font-bold text-xl mb-4">Current Staff</h2>
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : staffList.length === 0 ? (
          <p>No staff added yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {staffList.map((staff) => (
              <li
                key={staff.id}
                className="py-2 flex justify-between items-center"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="font-medium">{staff.name}</span>
                  <span className="text-gray-500">{staff.email}</span>
                  {/* ✅ Role badge */}
                  <RoleBadge role={staff.role} />
                </div>

                <button
                  onClick={() => confirmRemoveStaff(staff.id, staff.email)}
                  className="text-red-600 hover:text-red-800 font-bold text-sm"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add Staff Form (unchanged) */}
      <div className="w-[90%] sm:w-[600px] md:w-[800px]">
        <AddStaffForm onSuccess={fetchStaff} />
      </div>
    </section>
  );
}

// ------------------------------
// StaffDashboardPage (wrapper)
// ------------------------------
export default function StaffDashboardPage() {
  return (
    <RequireRole allowed={["BUSINESS_OWNER", "ADMIN"]}>
      <StaffDashboardContent />
    </RequireRole>
  );
}

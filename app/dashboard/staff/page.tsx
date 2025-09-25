// app/dashboard/staff/page.tsx
//
// Purpose:
// - Staff management dashboard (restricted to BUSINESS_OWNER + ADMIN).
// - Shows current staff list with "Remove" buttons.
// - Includes AddStaffForm to add new staff.
// - Displays toasts for Stripe success/cancel redirects AND staff removals.
// - Uses the new /api/staff/remove route for hard deletes.

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
  createdAt: string;
}

// ------------------------------
// StaffToastHandler
// ------------------------------
// - Handles toasts for Stripe redirect (?success / ?canceled).
// - Also cleans query params to prevent repeat toasts on refresh.
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

  // ✅ Remove staff via API
  const removeStaff = async (staffId: string, staffEmail: string) => {
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

      // Show confirmation toast
      toast.success(`✅ Removed staff: ${staffEmail}`, { duration: 4000 });

      // Refresh staff list
      fetchStaff();

      // Clean query params (in case ?removed=true is added later)
      window.history.replaceState(null, "", window.location.pathname);
    } catch (err) {
      console.error("[StaffDashboard] Remove error:", err);
      toast.error("Internal error removing staff");
    }
  };

  // Fetch staff on first mount
  useEffect(() => {
    fetchStaff();
  }, []);

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center gap-12">
      {/* ✅ Toast handler for Stripe redirects */}
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
                <div>
                  <span className="font-medium">{staff.name}</span>{" "}
                  <span className="text-gray-500">{staff.email}</span>
                </div>
                <button
                  onClick={() => removeStaff(staff.id, staff.email)}
                  className="text-red-600 hover:text-red-800 font-bold text-sm"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add Staff Form */}
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

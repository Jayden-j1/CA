// app/dashboard/staff/page.tsx
//
// Purpose:
// - Staff management dashboard (restricted to BUSINESS_OWNER + ADMIN).
// - Shows current staff list with "Remove" buttons (no add form here).
// - Removal flow includes a confirmation toast before the API call.
// - Uses /api/staff/remove (hard delete) and shows success toast with email
//   using the email returned by the API (source of truth).
// - Displays toasts for Stripe success/cancel when returning from checkout.
//
// Why changed:
// - You asked to keep Add Staff form ONLY on /dashboard/add-staff.
//   This page now strictly lists/removes users.

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import RequireRole from "@/components/auth/requiredRole";
import SearchParamsWrapper from "@/components/utils/searchParamsWrapper";

interface Staff {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

// Handles Stripe success/cancel return toasts and cleans params.
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

function StaffDashboardContent() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch current staff list for the business owner
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

  // Call backend to remove staff (hard delete).
  // We only pass staffId; we rely on the API's response to return the email
  // we display in the success toast.
  const removeStaff = async (staffId: string) => {
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

      // ✅ Use API-provided email to avoid relying on possibly stale client copy
      toast.success(`✅ Removed staff: ${data.email}`, { duration: 4000 });

      // Refresh the list and clean any stray query params
      fetchStaff();
      window.history.replaceState(null, "", window.location.pathname);
    } catch (err) {
      console.error("[StaffDashboard] Remove error:", err);
      toast.error("Internal error removing staff");
    }
  };

  // Confirmation UI before removal (prevents accidental clicks)
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
                removeStaff(staffId);
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

  useEffect(() => {
    fetchStaff();
  }, []);

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center gap-12">
      {/* Stripe success/cancel toast handler */}
      <SearchParamsWrapper>
        <StaffToastHandler onSuccess={fetchStaff} />
      </SearchParamsWrapper>

      <h1 className="text-white font-bold text-4xl sm:text-5xl text-center">
        Staff Management
      </h1>

      {/* Staff table only — no Add Staff form here */}
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

      {/* 🔗 Point users to the dedicated Add Staff page */}
      <p className="text-white/90">
        Want to add someone? Go to{" "}
        <a
          href="/dashboard/add-staff"
          className="underline font-semibold hover:text-white"
        >
          Add Staff
        </a>
        .
      </p>
    </section>
  );
}

export default function StaffDashboardPage() {
  return (
    <RequireRole allowed={["BUSINESS_OWNER", "ADMIN"]}>
      <StaffDashboardContent />
    </RequireRole>
  );
}

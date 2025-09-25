// app/dashboard/staff/page.tsx
//
// Purpose:
// - Staff management dashboard (restricted to BUSINESS_OWNER + ADMIN).
// - Shows current staff and provides form to add new staff.
// - When adding staff, user is redirected to Stripe checkout.
// - On returning from Stripe (?success / ?canceled), display toasts
//   to confirm payment success/failure and refresh staff list.
//
// Fix:
// - Refactored to use <SearchParamsWrapper> to safely handle useSearchParams()
//   inside Suspense, preventing Vercel build errors.

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation"; // ✅ read query params (?success / ?canceled)
import toast from "react-hot-toast"; // ✅ toast notifications
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
// Handles toasts for Stripe redirect (?success / ?canceled).
// Runs inside <SearchParamsWrapper> so it's Suspense-safe.
function StaffToastHandler({ onSuccess }: { onSuccess: () => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    const staffEmail = searchParams.get("staff"); // optional, for better context

    if (success) {
      toast.success(
        `🎉 Payment successful! ${
          staffEmail ? `${staffEmail} now has access.` : "Staff seat activated."
        }`,
        { duration: 6000 }
      );

      // ✅ Refresh staff list after payment
      onSuccess();

      // ✅ Clean query params so toast doesn’t repeat
      window.history.replaceState(null, "", window.location.pathname);
    }

    if (canceled) {
      toast.error(
        `❌ Payment canceled. ${
          staffEmail ? `${staffEmail} was not activated.` : ""
        }`,
        { duration: 6000 }
      );

      // ✅ Clean query params
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams, onSuccess]);

  return null; // no UI, just side effects
}

// ------------------------------
// StaffDashboardContent
// ------------------------------
// Handles:
// - Fetching staff list from API
// - Rendering staff table
// - Integrating AddStaffForm
// - Includes StaffToastHandler for payment feedback
function StaffDashboardContent() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch staff list from API
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

  // Fetch staff once on mount
  useEffect(() => {
    fetchStaff();
  }, []);

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center gap-12">
      {/* ✅ Toast handler wrapped in <SearchParamsWrapper> */}
      <SearchParamsWrapper>
        <StaffToastHandler onSuccess={fetchStaff} />
      </SearchParamsWrapper>

      {/* Page Heading */}
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
              <li key={staff.id} className="py-2 flex justify-between">
                <span>{staff.name}</span>
                <span className="text-gray-500">{staff.email}</span>
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
// Protects this route with <RequireRole> so only
// BUSINESS_OWNER + ADMIN can access it.
export default function StaffDashboardPage() {
  return (
    <RequireRole allowed={["BUSINESS_OWNER", "ADMIN"]}>
      <StaffDashboardContent />
    </RequireRole>
  );
}

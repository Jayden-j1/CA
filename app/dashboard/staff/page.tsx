// app/dashboard/staff/page.tsx
//
// Purpose:
// - Staff management dashboard (restricted to BUSINESS_OWNER + ADMIN).
// - Shows current staff and provides form to add new staff.
// - If staff are added → user is redirected to Stripe checkout for payment.
// - When returning from Stripe (?success=true or ?canceled=true),
//   show toast feedback and refresh staff list accordingly.

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import AddStaffForm from "@/components/forms/addStaffForm";
import RequireRole from "@/components/auth/requiredRole";

// ------------------------------
// Staff Type
// ------------------------------
// Matches what API /api/staff/list returns
interface Staff {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

// ------------------------------
// StaffDashboardContent
// ------------------------------
// Handles:
// - Fetching staff list from API
// - Rendering staff table
// - Integrating <AddStaffForm> (which redirects to Stripe checkout)
// - Toast messages when returning from Stripe
function StaffDashboardContent() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ✅ Grab query params (?success=true / ?canceled=true)
  const searchParams = useSearchParams();

  // ------------------------------
  // Fetch staff list from API
  // ------------------------------
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

  // Run once when page loads
  useEffect(() => {
    fetchStaff();
  }, []);

  // ------------------------------
  // Stripe Checkout redirect handling
  // ------------------------------
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    const staffEmail = searchParams.get("staff"); // optional extra info

    if (success) {
      toast.success(
        `🎉 Payment successful! ${
          staffEmail ? `${staffEmail} now has access.` : "Staff seat activated."
        }`
      );
      fetchStaff(); // Refresh staff list to show new member
      // ✅ Clean query params so toast doesn’t repeat
      window.history.replaceState(null, "", window.location.pathname);
    }

    if (canceled) {
      toast.error(
        `❌ Payment canceled. ${
          staffEmail ? `${staffEmail} was not activated.` : ""
        }`
      );
      // ✅ Clean query params
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams]);

  // ------------------------------
  // Render page
  // ------------------------------
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center gap-12">
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
// - Protects with <RequireRole> so only BUSINESS_OWNER + ADMIN
//   can access this route
export default function StaffDashboardPage() {
  return (
    <RequireRole allowed={["BUSINESS_OWNER", "ADMIN"]}>
      <StaffDashboardContent />
    </RequireRole>
  );
}

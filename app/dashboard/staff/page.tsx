// app/dashboard/staff/page.tsx
//
// Purpose:
// - Staff management dashboard (restricted to BUSINESS_OWNER + ADMIN).
// - Lists staff and allows removal.
// - Shows Stripe success/cancel toasts AND removal confirmation toast.
// - Auto-cleans query params (?success, ?canceled, ?removed) so toasts never re-trigger on refresh.

"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import RequireRole from "@/components/auth/requiredRole";
import SearchParamsWrapper from "@/components/utils/searchParamsWrapper";

interface Staff {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

// ------------------------------
// StaffStripeToastHandler
// ------------------------------
// Handles toasts for Stripe checkout (?success / ?canceled).
function StaffStripeToastHandler({ onSuccess }: { onSuccess: () => void }) {
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
// StaffRemovalToastHandler
// ------------------------------
// Detects ?removed=email and shows confirmation toast.
// Cleans query params to prevent duplicate toasts on refresh.
function StaffRemovalToastHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const removedEmail = searchParams.get("removed");

    if (removedEmail) {
      toast.success(`✅ Removed ${removedEmail} successfully.`, {
        duration: 6000,
      });

      // Clean query params
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams]);

  return null;
}

function StaffDashboardContent() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

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

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleRemove = async (staffId: string, staffEmail: string) => {
    if (!confirm(`Remove ${staffEmail} from your business?`)) return;

    try {
      const res = await fetch("/api/staff/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to remove staff", { duration: 6000 });
        return;
      }

      // ✅ Redirect with ?removed=email → toast will be handled in StaffRemovalToastHandler
      router.push(`/dashboard/staff?removed=${encodeURIComponent(staffEmail)}`);
    } catch (err) {
      console.error("[StaffDashboard] Remove error:", err);
      toast.error("Internal error", { duration: 6000 });
    }
  };

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center gap-12">
      <SearchParamsWrapper>
        <StaffStripeToastHandler onSuccess={fetchStaff} />
        <StaffRemovalToastHandler />
      </SearchParamsWrapper>

      <h1 className="text-white font-bold text-4xl sm:text-5xl text-center">
        Staff Management
      </h1>

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
                className="py-3 flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold">{staff.name}</p>
                  <p className="text-gray-500 text-sm">{staff.email}</p>
                </div>
                <button
                  onClick={() => handleRemove(staff.id, staff.email)}
                  className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
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

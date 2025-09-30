// app/dashboard/add-staff/page.tsx
//
// Purpose:
// - Restricts access to BUSINESS_OWNER.
// - Displays the allowed staff email domain (from /api/business/domain)
//   so owners see “Only @example.com emails are allowed”.
// - Renders the AddStaffForm (existing component).
//
// Why we do the domain fetch here?
// - To provide a clear UX message before submitting the form.
// - The server still enforces domain validation in /api/staff/add.

'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AddStaffForm from "@/components/forms/addStaffForm";

export default function AddStaffPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Local state to show the allowed domain (informational banner)
  const [allowedDomain, setAllowedDomain] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);

  // Access control
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && session?.user.role !== "BUSINESS_OWNER") {
      // NOTE: If you also want ADMIN to see this page, adjust the role check above
      router.push("/dashboard");
    }
  }, [status, session, router]);

  // Fetch the business domain for banner display
  useEffect(() => {
    if (status !== "authenticated") return;
    // Only attempt fetch if user is allowed here
    if (session?.user?.role !== "BUSINESS_OWNER") return;

    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/business/domain");
        const data = await res.json();
        if (!res.ok) {
          if (!ignore) setDomainError(data.error || "Unable to load domain");
          return;
        }
        if (!ignore) {
          setAllowedDomain(data.domain || null);
          setDomainError(null);
        }
      } catch (e: any) {
        if (!ignore) setDomainError("Network error loading domain");
      }
    })();

    return () => {
      ignore = true;
    };
  }, [status, session]);

  if (status === "loading") {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Loading add-staff page...</p>
      </section>
    );
  }

  if (!session?.user || session.user.role !== "BUSINESS_OWNER") {
    return null;
  }

  return (
    <section className="w-full flex flex-col justify-center items-center bg-gradient-to-b from-blue-700 to-blue-300 min-h-screen py-20">
      <h2 className="text-white font-bold text-3xl sm:text-4xl md:text-5xl tracking-wide mb-6 text-center">
        Add Staff User
      </h2>

      {/* Informational banner about domain restriction */}
      <div className="w-[90%] sm:w-[600px] md:w-[700px] bg-white/95 text-gray-800 rounded-lg shadow p-4 mb-6">
        {domainError ? (
          <p className="text-red-600 text-sm">
            ⚠️ {domainError}. You can still try adding staff — the server will enforce your domain policy.
          </p>
        ) : allowedDomain ? (
          <p className="text-sm">
            ✅ Only emails from <span className="font-semibold">@{allowedDomain}</span> are allowed for staff.
          </p>
        ) : (
          <p className="text-sm">Fetching allowed domain…</p>
        )}
      </div>

      {/* Existing form component (server enforces domain on submit) */}
      <AddStaffForm />
    </section>
  );
}

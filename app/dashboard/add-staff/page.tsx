// app/dashboard/add-staff/page.tsx
//
// Purpose:
// - Restricts access to BUSINESS_OWNER users.
// - Displays the allowed staff email domain (fetched from /api/business/domain).
// - Provides the AddStaffForm to invite staff accounts.
//
// Key fix (build error):
// - Next.js App Router requires hooks like useSearchParams/useRouter/useSession
//   to be wrapped in a <Suspense> boundary to avoid CSR bailout errors.
// - Even though this file doesn’t directly use useSearchParams, child components
//   (e.g. AddStaffForm) may, so we add a safe Suspense wrapper around the page.
//
// Pillars applied:
// - Efficiency: Suspense fallback is minimal (just a “Loading…” screen).
// - Robustness: Guards against both unauthenticated and unauthorized roles.
// - Simplicity: Clear separation of role check, domain fetch, and rendering.
// - Security: Role check enforced here + API validation on the server.

'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import AddStaffForm from "@/components/forms/addStaffForm";

function AddStaffPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Local state for the allowed staff email domain
  const [allowedDomain, setAllowedDomain] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);

  // ── 1) Access control
  useEffect(() => {
    if (status === "unauthenticated") {
      // 🚫 Not logged in → back to login
      router.push("/login");
    } else if (
      status === "authenticated" &&
      session?.user.role !== "BUSINESS_OWNER"
    ) {
      // 🚫 Logged in but not a business owner → back to dashboard
      router.push("/dashboard");
    }
  }, [status, session, router]);

  // ── 2) Fetch the allowed domain (UX hint only; server still validates)
  useEffect(() => {
    if (status !== "authenticated") return;
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
      } catch {
        if (!ignore) setDomainError("Network error loading domain");
      }
    })();

    return () => {
      ignore = true;
    };
  }, [status, session]);

  // ── 3) Loading + unauthorized states
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

  // ── 4) Main render
  return (
    <section className="w-full flex flex-col justify-center items-center bg-gradient-to-b from-blue-700 to-blue-300 min-h-screen py-20">
      <h2 className="text-white font-bold text-3xl sm:text-4xl md:text-5xl tracking-wide mb-6 text-center">
        Add Staff User
      </h2>

      {/* Informational banner about domain restriction */}
      <div className="w-[90%] sm:w-[600px] md:w-[700px] bg-white/95 text-gray-800 rounded-lg shadow p-4 mb-6">
        {domainError ? (
          <p className="text-red-600 text-sm">
            ⚠️ {domainError}. You can still try adding staff — the server will
            enforce your domain policy.
          </p>
        ) : allowedDomain ? (
          <p className="text-sm">
            ✅ Only emails from{" "}
            <span className="font-semibold">@{allowedDomain}</span> are allowed
            for staff.
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

// ── 5) Suspense wrapper to satisfy Next.js build/runtime requirements
// Any page using useRouter/useSearchParams/etc must be wrapped.
export default function AddStaffPage() {
  return (
    <Suspense
      fallback={
        <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
          <p className="text-white text-xl">Preparing add-staff page…</p>
        </section>
      }
    >
      <AddStaffPageInner />
    </Suspense>
  );
}

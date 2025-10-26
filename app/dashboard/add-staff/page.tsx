// app/dashboard/add-staff/page.tsx
//
// Purpose:
// - Allow BOTH BUSINESS_OWNER and BUSINESS-ADMIN (ADMIN with a businessId) to access Add Staff.
// - Show the allowed staff email domain (fetched from /api/business/domain).
// - Render the AddStaffForm to invite staff accounts.
//
// What changed (precise + minimal):
// - Access gate now admits: BUSINESS_OWNER OR (ADMIN && businessId != null).
// - Domain fetch now runs for those same roles (was BUSINESS_OWNER-only).
// - Render guard mirrors the exact same condition.
// - Everything else (UX, Suspense, layout, form integration) is unchanged.
//
// Why we also require businessId for ADMIN:
// - Prevents a "super-admin" (ADMIN with no businessId) from adding staff to arbitrary orgs.
// - Matches the backend API guard you already have.
//
// Pillars applied:
// - Efficiency: same fetch pattern; no extra queries.
// - Robustness: symmetric, explicit guards (redirects only when needed).
// - Simplicity: one, clear predicate reused in effect + render.
// - Ease of management: comments + no changes to unrelated code.
// - Security: page gate matches API gate (owner or business-scoped admin only).

'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import AddStaffForm from "@/components/forms/addStaffForm";

function AddStaffPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Local state for the allowed staff email domain (UX hint only)
  const [allowedDomain, setAllowedDomain] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);

  // ────────────────────────────────────────────────────────────
  // Helper: determine if the current user may access this page.
  // Allowed:
  //   • BUSINESS_OWNER
  //   • ADMIN with a businessId (i.e., admin of a specific business)
  // Blocked:
  //   • USER (regular staff)
  //   • ADMIN without businessId (super-admin)
  // ────────────────────────────────────────────────────────────
  const canAccess =
    !!session?.user &&
    (
      session.user.role === "BUSINESS_OWNER" ||
      (session.user.role === "ADMIN" && !!session.user.businessId)
    );

  // ── 1) Access control: apply redirects only when we know the session status.
  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      // 🚫 Not logged in → back to login
      router.push("/login");
      return;
    }

    // At this point, status === "authenticated"
    if (!canAccess) {
      // 🚫 Logged in but NOT owner or business-scoped admin → back to dashboard
      router.push("/dashboard");
    }
  }, [status, canAccess, router]);

  // ── 2) Fetch the allowed domain
  //    (Only when authenticated AND the user is allowed to access the page.)
  useEffect(() => {
    if (status !== "authenticated") return;
    if (!canAccess) return;

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
  }, [status, canAccess]);

  // ── 3) Loading + unauthorized states
  if (status === "loading") {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Loading add-staff page...</p>
      </section>
    );
  }

  // If we know the user is authenticated but not allowed, render nothing
  // (the effect above already redirected).
  if (status === "authenticated" && !canAccess) {
    return null;
  }

  // ── 4) Main render (only when allowed)
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

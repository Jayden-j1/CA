// app/dashboard/course/page.tsx
//
// Purpose
// -------
// Course landing page that requires paid access.
// We use the same authoritative probe as Map/Billing to avoid waiting on
// slow session refreshes after Stripe. This keeps the unlock instant.
//
// Notes on RSC vs client here
// ---------------------------
// If this page mostly renders server-only content, an RSC gate using a
// server-side helper could shave a bit of client work. However, to keep your
// code consistent (and because you asked for updates directly in this file),
// we implement the robust client approach using usePaidAccess().
// If you later want an RSC version, I can split this into:
//   • server page (does the gate)
//   • small client child for any interactive bits
//
// Pillars
// -------
// - Efficiency: tiny probe; brief polling only on ?success=true.
// - Robustness: server is source of truth; self-heal respected.
// - Simplicity: identical pattern to Billing/Map.
// - Security: no client mutation; read-only probe.

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePaidAccess } from "@/hooks/usePaidAccess";

export default function CoursePage() {
  const router = useRouter();
  const access = usePaidAccess();

  useEffect(() => {
    if (access.loading) return;
    if (!access.hasAccess) {
      router.replace("/dashboard/upgrade");
    }
  }, [access.loading, access.hasAccess, router]);

  if (access.loading) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Checking access…</p>
      </section>
    );
  }

  if (!access.hasAccess) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Redirecting…</p>
      </section>
    );
  }

  // ✅ Paid users see the Course UI
  return (
    <section className="w-full min-h-screen p-6">
      {/* Replace below with your real Course content */}
      <h1 className="text-3xl font-bold mb-4">Course</h1>
      <p>Welcome! Your access is active.</p>
    </section>
  );
}

// app/dashboard/map/page.tsx
//
// Purpose:
// - Interactive Map page inside the dashboard.
// - Uses the shared /api/payments/check API to gate access (same as course page).
// - Only shows content if user has purchased access.
// - Otherwise, redirects them to /dashboard/upgrade.
//
// Notes:
// - This avoids duplicating Prisma logic here.
// - Middleware still ensures user is logged in.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface PaymentCheckResponse {
  hasAccess: boolean;
}

export default function MapPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  // ✅ Check access using /api/payments/check
  const checkAccess = async () => {
    try {
      const res = await fetch("/api/payments/check");
      const data: PaymentCheckResponse = await res.json();

      if (!res.ok || !data.hasAccess) {
        router.push("/dashboard/upgrade"); // 🚫 redirect if unpaid
      } else {
        setHasAccess(true);
      }
    } catch (err) {
      console.error("[MapPage] Access check failed:", err);
      router.push("/dashboard/upgrade");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAccess();
  }, []);

  if (loading) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Checking map access...</p>
      </section>
    );
  }

  if (!hasAccess) return null; // don’t render flicker

  // ✅ Authorized → show the map content
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
        Interactive Map
      </h1>

      {/* Replace this with your actual map component later */}
      <div className="w-[90%] sm:w-[600px] md:w-[900px] bg-white rounded-xl shadow-xl p-6">
        <p className="text-gray-700">
          🌍 Map content goes here (only visible to paid users).
        </p>
      </div>
    </section>
  );
}

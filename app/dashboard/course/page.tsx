// app/dashboard/course/page.tsx
//
// Purpose:
// - Internal course content page.
// - Only accessible if the logged-in user (or staff added via business) has
//   at least one Payment record in the DB.
// - Otherwise, they are redirected to /dashboard/upgrade.
//
// Notes:
// - Mirrors gating logic from /dashboard/map.
// - Replace placeholder video/text with real course material later.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface PaymentCheckResponse {
  hasAccess: boolean;
}

export default function CourseContentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  // ✅ Check with backend if user has an active payment
  const checkAccess = async () => {
    try {
      const res = await fetch("/api/payments/check"); // you’ll create this API
      const data: PaymentCheckResponse = await res.json();

      if (!res.ok || !data.hasAccess) {
        router.push("/dashboard/upgrade"); // redirect if unpaid
      } else {
        setHasAccess(true);
      }
    } catch (err) {
      console.error("[CourseContent] Access check failed:", err);
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
        <p className="text-white text-xl">Checking course access...</p>
      </section>
    );
  }

  if (!hasAccess) return null; // avoid flicker before redirect

  // ✅ User has access → show course content
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center gap-12">
      <h1 className="text-white font-bold text-4xl sm:text-5xl text-center">
        Course Content
      </h1>
      <div className="w-[90%] sm:w-[600px] md:w-[800px] bg-white rounded-xl p-6 shadow-xl">
        <h2 className="font-bold text-xl mb-4">Welcome to the Training!</h2>
        <p className="mb-4">
          🎥 Video lessons and materials will appear here. Replace this
          placeholder with your real course modules.
        </p>
        <p>
          ✅ Because you’ve purchased access, you can view this course. Staff
          added by a business owner will also see this once their seat is paid.
        </p>
      </div>
    </section>
  );
}

// app/dashboard/course/page.tsx
//
// Purpose:
// - Internal course content page (dashboard).
// - Accessible ONLY if the logged-in user has a successful Payment record.
//   (either direct purchase or via staff seat paid by business owner).
// - If no payment exists → redirect to /dashboard/upgrade.
//
// Fix / Retrofit:
// - Uses centralized API route (/api/payments/check) for gating logic.
// - Matches structure used in /dashboard/map for consistency.
// - Prevents UI flicker by checking access before rendering content.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ------------------------------
// Shape of API response
// ------------------------------
interface PaymentCheckResponse {
  hasAccess: boolean; // true = user has at least one Payment record
}

export default function CourseContentPage() {
  const router = useRouter();

  // ✅ Local state
  const [loading, setLoading] = useState(true); // while checking API
  const [hasAccess, setHasAccess] = useState(false); // track access result

  // ------------------------------
  // Call backend → /api/payments/check
  // ------------------------------
  const checkAccess = async () => {
    try {
      const res = await fetch("/api/payments/check", {
        method: "GET",
      });

      const data: PaymentCheckResponse = await res.json();

      if (!res.ok || !data.hasAccess) {
        // 🚫 User has NOT paid → redirect to upgrade page
        router.push("/dashboard/upgrade");
      } else {
        // ✅ Paid user → unlock course
        setHasAccess(true);
      }
    } catch (err) {
      console.error("[CourseContent] Access check failed:", err);
      router.push("/dashboard/upgrade");
    } finally {
      setLoading(false);
    }
  };

  // Run once when page loads
  useEffect(() => {
    checkAccess();
  }, []);

  // ------------------------------
  // Render UI
  // ------------------------------
  if (loading) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Checking course access...</p>
      </section>
    );
  }

  if (!hasAccess) {
    // 🚫 Avoid flicker if redirect is already happening
    return null;
  }

  // ✅ Paid user → render course content
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center gap-12">
      {/* Page Heading */}
      <h1 className="text-white font-bold text-4xl sm:text-5xl text-center">
        Course Content
      </h1>

      {/* Placeholder for course material */}
      <div className="w-[90%] sm:w-[600px] md:w-[800px] bg-white rounded-xl p-6 shadow-xl">
        <h2 className="font-bold text-xl mb-4">Welcome to the Training!</h2>
        <p className="mb-4">
          🎥 Video lessons and cultural awareness materials will appear here.
          Replace this placeholder with your actual course modules.
        </p>
        <p>
          ✅ Because you’ve purchased access, you can view this course. Staff
          added by a business owner will also see this once their seat payment
          is completed.
        </p>
      </div>
    </section>
  );
}

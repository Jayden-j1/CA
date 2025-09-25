// app/dashboard/course/page.tsx
//
// Purpose:
// - Internal course content page (dashboard).
// - Uses centralized /api/payments/check API for gating.
// - Displays package type + latest payment details.
// - Redirects unpaid users to /dashboard/upgrade.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface PaymentCheckResponse {
  hasAccess: boolean;
  packageType: "individual" | "business" | null;
  latestPayment: {
    id: string;
    createdAt: string;
    amount: number;
  } | null;
}

export default function CourseContentPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [packageType, setPackageType] = useState<"individual" | "business" | null>(null);
  const [latestPayment, setLatestPayment] = useState<PaymentCheckResponse["latestPayment"]>(null);

  const checkAccess = async () => {
    try {
      const res = await fetch("/api/payments/check");
      const data: PaymentCheckResponse = await res.json();

      if (!res.ok || !data.hasAccess) {
        router.push("/dashboard/upgrade");
      } else {
        setHasAccess(true);
        setPackageType(data.packageType);
        setLatestPayment(data.latestPayment);
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

  if (!hasAccess) return null;

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center gap-12">
      <h1 className="text-white font-bold text-4xl sm:text-5xl text-center">
        Course Content
      </h1>

      {/* Show package + payment info */}
      {packageType && (
        <p className="text-white mb-2 text-lg">
          You are on the <strong>{packageType}</strong> package.
        </p>
      )}
      {latestPayment && (
        <p className="text-white mb-6 text-md">
          Last purchase: <strong>${latestPayment.amount}</strong> on{" "}
          {new Date(latestPayment.createdAt).toLocaleDateString()}
        </p>
      )}

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

// app/dashboard/course/page.tsx
//
// Purpose:
// - Internal course content page (dashboard).
// - Uses centralized /api/payments/check API for gating.
// - With the new behavior, access is granted if:
//   1) a PACKAGE payment exists for the user, OR
//   2) a STAFF_SEAT payment exists for that specific staff user.
//
// UX:
// - Short loading state → if no access redirect to /dashboard/upgrade.
// - Show package type + latest payment details.
// - "business" packageType may represent either a business package or a staff-seat.
//
// Robustness updates:
// - AbortController to stop fetch on unmount.
// - didRedirect ref to avoid double pushes.

"use client";

import { useEffect, useRef, useState } from "react";
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

  const [packageType, setPackageType] =
    useState<"individual" | "business" | null>(null);
  const [latestPayment, setLatestPayment] =
    useState<PaymentCheckResponse["latestPayment"]>(null);

  const didRedirect = useRef(false);

  const checkAccess = async (signal: AbortSignal) => {
    const res = await fetch("/api/payments/check", { signal });
    const data: PaymentCheckResponse = await res.json();

    if (!res.ok || !data.hasAccess) {
      if (!didRedirect.current) {
        didRedirect.current = true;
        router.push("/dashboard/upgrade");
      }
    } else {
      setHasAccess(true);
      setPackageType(data.packageType);
      setLatestPayment(data.latestPayment);
    }
  };

  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      try {
        await checkAccess(ac.signal);
      } catch (err) {
        console.error("[CourseContent] Access check failed:", err);
        if (!didRedirect.current) {
          didRedirect.current = true;
          router.push("/dashboard/upgrade");
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [router]);

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
          🎥 Video lessons and cultural awareness materials will go here.
        </p>
        <p>
          ✅ Purchased accounts (PACKAGE) and paid staff seats (STAFF_SEAT)
          have access. Staff added by a business owner will see this once their
          payment is completed.
        </p>
      </div>
    </section>
  );
}

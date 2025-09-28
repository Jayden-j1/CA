// app/dashboard/map/page.tsx
//
// Purpose:
// - Dashboard page that checks subscription/payment before rendering the map.
// - With the new /api/payments/check behavior, access is granted if the user has:
//   1) a PACKAGE payment (individual or business), OR
//   2) a STAFF_SEAT payment saved under their own userId (i.e., paid staff member).
//
// UX:
// - Show a short loading state while checking access.
// - If no access → redirect to /dashboard/upgrade.
// - If access → show map + package/payment info.
//
// Robustness updates:
// - Added AbortController to clean up fetch on unmount.
// - Added didRedirect ref to prevent double-push in React Strict Mode.

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GoogleMapComponent from "@/components/GoogleMap/GoogleMapComponent";

// ------------------------------
// API Response Type
// ------------------------------
interface PaymentCheckResponse {
  hasAccess: boolean;
  packageType: "individual" | "business" | null;
  latestPayment: {
    id: string;
    createdAt: string;
    amount: number;
  } | null;
}

export default function MapPage() {
  const router = useRouter();

  // UI flags
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  // Data to show above the map
  const [packageType, setPackageType] =
    useState<"individual" | "business" | null>(null);
  const [latestPayment, setLatestPayment] =
    useState<PaymentCheckResponse["latestPayment"]>(null);

  // Prevent double redirects in React Strict Mode
  const didRedirect = useRef(false);

  // ------------------------------
  // Check payment-based access
  // ------------------------------
  useEffect(() => {
    const ac = new AbortController();

    const checkAccess = async () => {
      try {
        const res = await fetch("/api/payments/check", { signal: ac.signal });
        const data: PaymentCheckResponse = await res.json();

        if (!res.ok || !data.hasAccess) {
          // Avoid double push in Strict Mode
          if (!didRedirect.current) {
            didRedirect.current = true;
            router.push("/dashboard/upgrade");
          }
        } else {
          setHasAccess(true);
          setPackageType(data.packageType);
          setLatestPayment(data.latestPayment);
        }
      } catch (err) {
        console.error("[MapPage] Access check failed:", err);
        if (!didRedirect.current) {
          didRedirect.current = true;
          router.push("/dashboard/upgrade");
        }
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
    return () => ac.abort();
  }, [router]);

  // ------------------------------
  // Loading + access guard
  // ------------------------------
  if (loading) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Checking map access...</p>
      </section>
    );
  }

  if (!hasAccess) return null;

  // ------------------------------
  // Main Render
  // ------------------------------
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-16 flex flex-col items-center">
      {/* Heading */}
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-3">
        Interactive Map
      </h1>

      {/* Package / Payment info */}
      {packageType && (
        <p className="text-white mb-1 text-lg">
          {/* For staff seats, /api/payments/check returns "business" as the package type */}
          You are on the <strong>{packageType}</strong> package.
        </p>
      )}
      {latestPayment && (
        <p className="text-white mb-6 text-md">
          Last purchase: <strong>${latestPayment.amount}</strong> on{" "}
          {new Date(latestPayment.createdAt).toLocaleDateString()}
        </p>
      )}

      {/* ✅ Direct map render (component handles its own sizing) */}
      <GoogleMapComponent />
    </section>
  );
}

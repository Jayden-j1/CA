// app/dashboard/map/page.tsx
//
// Purpose:
// - Dashboard page that checks subscription/payment before rendering the map.
// - With the updated /api/payments/check, access is granted if:
//   1) a PACKAGE payment exists, OR
//   2) a STAFF_SEAT payment exists for this staff user.
//
// Improvements:
// - Proper AbortController handling to avoid AbortError.
// - Prevent double redirects using didRedirect ref.

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GoogleMapComponent from "@/components/GoogleMap/GoogleMapComponent";

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

  // State for UI
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [packageType, setPackageType] =
    useState<"individual" | "business" | null>(null);
  const [latestPayment, setLatestPayment] =
    useState<PaymentCheckResponse["latestPayment"]>(null);

  // Prevent duplicate redirects (React Strict Mode runs effects twice)
  const didRedirect = useRef(false);

  useEffect(() => {
    const ac = new AbortController();

    const checkAccess = async () => {
      try {
        const res = await fetch("/api/payments/check", { signal: ac.signal });
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
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[MapPage] Access check failed:", err);
          if (!didRedirect.current) {
            didRedirect.current = true;
            router.push("/dashboard/upgrade");
          }
        }
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
    return () => ac.abort();
  }, [router]);

  if (loading) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Checking map access...</p>
      </section>
    );
  }

  if (!hasAccess) return null;

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-16 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-3">
        Interactive Map
      </h1>

      {/* Package/payment info */}
      {packageType && (
        <p className="text-white mb-1 text-lg">
          You are on the <strong>{packageType}</strong> package.
        </p>
      )}
      {latestPayment && (
        <p className="text-white mb-6 text-md">
          Last purchase: <strong>${latestPayment.amount}</strong> on{" "}
          {new Date(latestPayment.createdAt).toLocaleDateString()}
        </p>
      )}

      <GoogleMapComponent />
    </section>
  );
}

// app/dashboard/map/page.tsx
//
// Purpose:
// - Dashboard page that checks subscription/payment before rendering the map.
// - Displays package/payment info above the map.
// - Renders GoogleMapComponent directly, without extra wrappers that conflict
//   with its internal layout.

"use client";

import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [packageType, setPackageType] =
    useState<"individual" | "business" | null>(null);
  const [latestPayment, setLatestPayment] =
    useState<PaymentCheckResponse["latestPayment"]>(null);

  // ------------------------------
  // Check payment-based access
  // ------------------------------
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
      console.error("[MapPage] Access check failed:", err);
      router.push("/dashboard/upgrade");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAccess();
  }, []);

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

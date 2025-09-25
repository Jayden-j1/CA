// app/dashboard/map/page.tsx
//
// Purpose:
// - Interactive Map page inside the dashboard.
// - Uses the shared /api/payments/check API for gating.
// - Displays package type + latest payment details.
// - Imports and renders the GoogleMapComponent.
// - Layout fix: ensures map is centered inside its container.

"use client";

import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [packageType, setPackageType] =
    useState<"individual" | "business" | null>(null);
  const [latestPayment, setLatestPayment] =
    useState<PaymentCheckResponse["latestPayment"]>(null);

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

  if (loading) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Checking map access...</p>
      </section>
    );
  }

  if (!hasAccess) return null;

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-4">
        Interactive Map
      </h1>

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

      {/* ✅ Wrapper ensures the map is centered */}
      <div className="w-full flex justify-center">
        <div className="w-[90%] sm:w-[600px] md:w-[900px] h-[70vh] bg-white rounded-xl shadow-xl overflow-hidden">
          <GoogleMapComponent />
        </div>
      </div>
    </section>
  );
}

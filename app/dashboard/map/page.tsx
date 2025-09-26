// app/dashboard/map/page.tsx
//
// Purpose:
// - Interactive Map page inside the dashboard.
// - Uses /api/payments/check to gate access (only paid users can view).
// - Displays package type + latest payment details.
// - Renders GoogleMapComponent inside a responsive centered container.
//
// Layout fix summary:
// - We now wrap the map in a responsive <div> with a fixed height (70vh).
// - The child map is forced to fill that wrapper with w-full h-full.
// - This ensures no cropping, smooth resizing, and proper centering.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GoogleMapComponent from "@/components/GoogleMap/GoogleMapComponent"; // ✅ confirm this path matches your file

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
  // Loading state
  // ------------------------------
  if (loading) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Checking map access...</p>
      </section>
    );
  }

  // ------------------------------
  // Block unpaid users
  // ------------------------------
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

      {/* ✅ Map container: centered, responsive, no cropping */}
      <div className="w-[90%] sm:w-[600px] md:w-[900px] h-[70vh] bg-white rounded-xl shadow-xl flex items-center justify-center">
        {/* <div className="w-full h-full flex items-center justify-center"> */}
          <GoogleMapComponent />
        {/* </div> */}
      </div>
    </section>
  );
}

// app/dashboard/map/page.tsx
//
// Purpose:
// - Interactive Map page inside the dashboard.
// - Uses the shared /api/payments/check API for gating.
// - Displays package type + latest payment details.
// - Imports and renders the GoogleMapComponent WITHOUT any extra wrappers
//   so the map controls its own size/centering (prevents cropping).
//
// Why your map looked cut off:
// - Previously the map component (which already contains its own centered,
//   fixed-height container) was nested inside another div with sizing rules
//   (aspect ratio / overflow). That outer wrapper conflicted with the map’s
//   own layout and clipped the bottom.
// - Fix: render the map component directly, and correct the import path to
//   match your file structure (GoogleMap.tsx exports default GoogleMapComponent).
//
// Bonus checks if you still don't see the map:
// - Ensure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set at build/runtime.
// - Ensure NEXT_PUBLIC_MAP_ID (if used) exists in your Google Cloud console.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
// ✅ Correct import path: your file is components/GoogleMap/GoogleMap.tsx
//    with default export `GoogleMapComponent`
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

  // Check access using unified API
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

      {/* ✅ Render the map component directly. It already centers itself and sets its own height.
          Removing extra wrappers avoids conflicting styles that previously clipped the bottom. */}
      <GoogleMapComponent />
    </section>
  );
}

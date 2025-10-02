// app/dashboard/map/page.tsx
//
// Purpose:
// - Gate the Map page based on payment/subscription.
// - If the session says hasPaid === true, unlock immediately (fast path).
// - Still query /api/payments/check to populate package info and as a server-source of truth.
// - If unpaid (or server denies), redirect to /dashboard/upgrade.
//
// Why both session + API?
// - session.user.hasPaid is computed centrally in NextAuth (lib/auth.ts) and is cheap.
// - /api/payments/check returns extra details (packageType, latestPayment) for display.
// - If there’s ever a mismatch, we defer to the server response.
//
// Pillars:
// - Efficiency: fast allow via session; single API call for details.
// - Robustness: abort controller, duplicate-redirect guard, safe fallbacks.
// - Simplicity: no external libs; single effect orchestrates flow.
// - Security: trust server for final authorization; never rely solely on client state.

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
  const { data: session, status } = useSession();

  // UI / data state
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [packageType, setPackageType] =
    useState<"individual" | "business" | null>(null);
  const [latestPayment, setLatestPayment] =
    useState<PaymentCheckResponse["latestPayment"]>(null);

  // Prevent duplicate redirects in strict mode
  const didRedirect = useRef(false);

  useEffect(() => {
    const ac = new AbortController();

    const run = async () => {
      // Wait until session readiness is known
      if (status === "loading") return;

      try {
        // Fast path: if session says paid, optimistically unlock immediately.
        if (session?.user?.hasPaid) {
          setHasAccess(true);
        }

        // Always ask the server for details (and to double-check access).
        const res = await fetch("/api/payments/check", { signal: ac.signal });
        const data: PaymentCheckResponse = await res.json();

        if (!res.ok || !data.hasAccess) {
          // Server denies access → redirect to upgrade (even if session was optimistic)
          if (!didRedirect.current) {
            didRedirect.current = true;
            router.push("/dashboard/upgrade");
          }
          return;
        }

        // Server allows access → persist details for display.
        setHasAccess(true);
        setPackageType(data.packageType);
        setLatestPayment(data.latestPayment);
      } catch (err) {
        // Ignore AbortError
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

    run();
    return () => ac.abort();
  }, [status, session?.user?.hasPaid, router]);

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









// // app/dashboard/map/page.tsx
// //
// // Purpose:
// // - Dashboard page that checks subscription/payment before rendering the map.
// // - With the updated /api/payments/check, access is granted if:
// //   1) a PACKAGE payment exists, OR
// //   2) a STAFF_SEAT payment exists for this staff user.
// //
// // Improvements:
// // - Proper AbortController handling to avoid AbortError.
// // - Prevent double redirects using didRedirect ref.

// "use client";

// import { useEffect, useRef, useState } from "react";
// import { useRouter } from "next/navigation";
// import GoogleMapComponent from "@/components/GoogleMap/GoogleMapComponent";

// interface PaymentCheckResponse {
//   hasAccess: boolean;
//   packageType: "individual" | "business" | null;
//   latestPayment: {
//     id: string;
//     createdAt: string;
//     amount: number;
//   } | null;
// }

// export default function MapPage() {
//   const router = useRouter();

//   // State for UI
//   const [loading, setLoading] = useState(true);
//   const [hasAccess, setHasAccess] = useState(false);
//   const [packageType, setPackageType] =
//     useState<"individual" | "business" | null>(null);
//   const [latestPayment, setLatestPayment] =
//     useState<PaymentCheckResponse["latestPayment"]>(null);

//   // Prevent duplicate redirects (React Strict Mode runs effects twice)
//   const didRedirect = useRef(false);

//   useEffect(() => {
//     const ac = new AbortController();

//     const checkAccess = async () => {
//       try {
//         const res = await fetch("/api/payments/check", { signal: ac.signal });
//         const data: PaymentCheckResponse = await res.json();

//         if (!res.ok || !data.hasAccess) {
//           if (!didRedirect.current) {
//             didRedirect.current = true;
//             router.push("/dashboard/upgrade");
//           }
//         } else {
//           setHasAccess(true);
//           setPackageType(data.packageType);
//           setLatestPayment(data.latestPayment);
//         }
//       } catch (err) {
//         if (!(err instanceof DOMException && err.name === "AbortError")) {
//           console.error("[MapPage] Access check failed:", err);
//           if (!didRedirect.current) {
//             didRedirect.current = true;
//             router.push("/dashboard/upgrade");
//           }
//         }
//       } finally {
//         setLoading(false);
//       }
//     };

//     checkAccess();
//     return () => ac.abort();
//   }, [router]);

//   if (loading) {
//     return (
//       <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
//         <p className="text-white text-xl">Checking map access...</p>
//       </section>
//     );
//   }

//   if (!hasAccess) return null;

//   return (
//     <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-16 flex flex-col items-center">
//       <h1 className="text-white font-bold text-4xl sm:text-5xl mb-3">
//         Interactive Map
//       </h1>

//       {/* Package/payment info */}
//       {packageType && (
//         <p className="text-white mb-1 text-lg">
//           You are on the <strong>{packageType}</strong> package.
//         </p>
//       )}
//       {latestPayment && (
//         <p className="text-white mb-6 text-md">
//           Last purchase: <strong>${latestPayment.amount}</strong> on{" "}
//           {new Date(latestPayment.createdAt).toLocaleDateString()}
//         </p>
//       )}

//       <GoogleMapComponent />
//     </section>
//   );
// }

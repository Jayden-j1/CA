// app/dashboard/course/page.tsx
//
// Purpose:
// - Gate the Course page exactly like Map.
// - Unlock quickly if session.hasPaid is true, then confirm + hydrate details via API.
// - If server denies, redirect to /dashboard/upgrade.
//
// Pillars:
// - Efficiency: quick allow via session.
// - Robustness: abort controller, duplicate-redirect guard.
// - Simplicity & Security: server remains source-of-truth for final access and details.

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

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
  const { data: session, status } = useSession();

  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [packageType, setPackageType] =
    useState<"individual" | "business" | null>(null);
  const [latestPayment, setLatestPayment] =
    useState<PaymentCheckResponse["latestPayment"]>(null);

  const didRedirect = useRef(false);

  useEffect(() => {
    const ac = new AbortController();

    const run = async () => {
      if (status === "loading") return;

      try {
        // Optimistic unlock if session claims paid.
        if (session?.user?.hasPaid) {
          setHasAccess(true);
        }

        // Fetch details + confirm authorization.
        const res = await fetch("/api/payments/check", { signal: ac.signal });
        const data: PaymentCheckResponse = await res.json();

        if (!res.ok || !data.hasAccess) {
          if (!didRedirect.current) {
            didRedirect.current = true;
            router.push("/dashboard/upgrade");
          }
          return;
        }

        setHasAccess(true);
        setPackageType(data.packageType);
        setLatestPayment(data.latestPayment);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[CourseContent] Access check failed:", err);
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
          ✅ Purchased accounts (PACKAGE) and paid staff seats (STAFF_SEAT) have
          access. Staff added by a business owner will see this once their
          payment is completed.
        </p>
      </div>
    </section>
  );
}









// // app/dashboard/course/page.tsx
// //
// // Purpose:
// // - Gated course content page.
// // - Access granted if user has PACKAGE payment OR STAFF_SEAT payment.
// //
// // Improvements:
// // - Added AbortController cleanup.
// // - Safe handling of AbortError.
// // - Prevent duplicate redirects with didRedirect.

// "use client";

// import { useEffect, useRef, useState } from "react";
// import { useRouter } from "next/navigation";

// interface PaymentCheckResponse {
//   hasAccess: boolean;
//   packageType: "individual" | "business" | null;
//   latestPayment: {
//     id: string;
//     createdAt: string;
//     amount: number;
//   } | null;
// }

// export default function CourseContentPage() {
//   const router = useRouter();

//   const [loading, setLoading] = useState(true);
//   const [hasAccess, setHasAccess] = useState(false);
//   const [packageType, setPackageType] =
//     useState<"individual" | "business" | null>(null);
//   const [latestPayment, setLatestPayment] =
//     useState<PaymentCheckResponse["latestPayment"]>(null);

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
//           console.error("[CourseContent] Access check failed:", err);
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
//         <p className="text-white text-xl">Checking course access...</p>
//       </section>
//     );
//   }

//   if (!hasAccess) return null;

//   return (
//     <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center gap-12">
//       <h1 className="text-white font-bold text-4xl sm:text-5xl text-center">
//         Course Content
//       </h1>

//       {packageType && (
//         <p className="text-white mb-2 text-lg">
//           You are on the <strong>{packageType}</strong> package.
//         </p>
//       )}
//       {latestPayment && (
//         <p className="text-white mb-6 text-md">
//           Last purchase: <strong>${latestPayment.amount}</strong> on{" "}
//           {new Date(latestPayment.createdAt).toLocaleDateString()}
//         </p>
//       )}

//       <div className="w-[90%] sm:w-[600px] md:w-[800px] bg-white rounded-xl p-6 shadow-xl">
//         <h2 className="font-bold text-xl mb-4">Welcome to the Training!</h2>
//         <p className="mb-4">
//           🎥 Video lessons and cultural awareness materials will go here.
//         </p>
//         <p>
//           ✅ Purchased accounts (PACKAGE) and paid staff seats (STAFF_SEAT) have
//           access. Staff added by a business owner will see this once their
//           payment is completed.
//         </p>
//       </div>
//     </section>
//   );
// }

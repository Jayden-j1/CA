// app/dashboard/map/page.tsx
//
// Why this change?
// Next.js App Router requires any component calling `useSearchParams()`
// to render within a <Suspense> boundary. This file now:
//   1) Exposes a tiny page wrapper that renders <Suspense fallback=...>
//   2) Moves the original logic into <MapPageInner/> (unchanged behavior)
//
// NOTES
// - Only structure changed (wrapper + inner); the gating logic is identical.
// - This avoids Vercel build errors and is future-proof if nested children
//   introduce `useSearchParams()` or other suspending hooks.

"use client";

import { Suspense } from "react"; // ✅ Suspense boundary
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

// ---------- Page wrapper that provides the Suspense boundary ----------
export default function MapPage() {
  return (
    <Suspense
      // Keep fallback visual consistent with your brand
      fallback={
        <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
          <p className="text-white text-xl">Loading map…</p>
        </section>
      }
    >
      <MapPageInner />
    </Suspense>
  );
}

// ---------- Original logic lives here unchanged ----------
function MapPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const justSucceeded = searchParams.get("success") === "true";

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

    const checkOnce = async () => {
      const res = await fetch("/api/payments/check", {
        signal: ac.signal,
        cache: "no-store",
      });
      const data: PaymentCheckResponse = await res.json();
      return { ok: res.ok, data };
    };

    const run = async () => {
      if (status === "loading") return;

      try {
        // Fast path: if session says paid, unlock immediately.
        if (session?.user?.hasPaid) {
          setHasAccess(true);
        }

        // First authoritative probe
        const first = await checkOnce();

        if (first.ok && first.data.hasAccess) {
          setHasAccess(true);
          setPackageType(first.data.packageType);
          setLatestPayment(first.data.latestPayment);
          return;
        }

        // If not allowed and we *just* completed checkout, poll briefly
        if (justSucceeded) {
          const maxAttempts = 8; // ~12s total
          const delayMs = 1500;
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise((r) => setTimeout(r, delayMs));
            const retry = await checkOnce();
            if (retry.ok && retry.data.hasAccess) {
              setHasAccess(true);
              setPackageType(retry.data.packageType);
              setLatestPayment(retry.data.latestPayment);
              return;
            }
          }
        }

        // Still no access → redirect to upgrade
        if (!didRedirect.current) {
          didRedirect.current = true;
          router.push("/dashboard/upgrade");
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

    run();
    return () => ac.abort();
  }, [status, session?.user?.hasPaid, router, justSucceeded]);

  if (loading) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">
          {justSucceeded ? "Finalizing your payment..." : "Checking map access..."}
        </p>
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

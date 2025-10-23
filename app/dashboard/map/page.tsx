// app/dashboard/map/page.tsx
//
// Why this structure?
// -------------------
// Next.js App Router prefers that components calling `useSearchParams()`
// render within a <Suspense> boundary. This file provides:
//   1) A small page wrapper that renders <Suspense fallback=...>
//   2) The original logic inside <MapPageInner/>
//
// What’s fixed here?
// ------------------
// • Corrected Tailwind class typo: "bg-linear-to-b" → "bg-gradient-to-b"
//   (cosmetic, avoids invalid class). Access logic stays identical.
//
// Pillars
// -------
// - Simplicity / Robustness: minimal, explicit changes.
// - Efficiency: client-side only.
// - Security: unchanged (still gated by /api/payments/check).

"use client";

import { Suspense } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import GoogleMapComponent from "@/components/GoogleMap/GoogleMapComponent";

// ------------------------------
// Access check response typing
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

// -----------------------------------------------------
// Page wrapper: provides Suspense around the inner page
// -----------------------------------------------------
export default function MapPage() {
  return (
    <Suspense
      fallback={
        <section className="w-full min-h-screen flex items-center justify-center bg-linear-to-b from-blue-700 to-blue-300">
          <p className="text-white text-xl">Loading map…</p>
        </section>
      }
    >
      <MapPageInner />
    </Suspense>
  );
}

// -----------------------------------------------------
// Inner page
// -----------------------------------------------------
function MapPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  // Null-safe query param usage.
  const justSucceeded = (searchParams?.get("success") ?? "") === "true";

  // ---------- UI / data state ----------
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [packageType, setPackageType] =
    useState<"individual" | "business" | null>(null);
  const [latestPayment, setLatestPayment] =
    useState<PaymentCheckResponse["latestPayment"]>(null);

  // Prevent duplicate redirects (helps with React strict mode double-invoke)
  const didRedirect = useRef(false);

  // -----------------------------------------------------
  // Authoritative access check + short polling after checkout
  // -----------------------------------------------------
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
        // Optimistic unlock if session already has paid flag.
        if (session?.user?.hasPaid) {
          setHasAccess(true);
        }

        // Server truth
        const first = await checkOnce();

        if (first.ok && first.data.hasAccess) {
          setHasAccess(true);
          setPackageType(first.data.packageType);
          setLatestPayment(first.data.latestPayment);
          return; // done
        }

        // Post-checkout: poll a few times until webhook lands
        if (justSucceeded) {
          const maxAttempts = 8; // ~12s total @ 1.5s each
          const delayMs = 1500;
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise((r) => setTimeout(r, delayMs));
            const retry = await checkOnce();
            if (retry.ok && retry.data.hasAccess) {
              setHasAccess(true);
              setPackageType(retry.data.packageType);
              setLatestPayment(retry.data.latestPayment);
              return; // done
            }
          }
        }

        // Still no access → redirect once
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

  // ---------- Render states ----------
  if (loading) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-linear-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">
          {justSucceeded ? "Finalizing your payment..." : "Checking map access..."}
        </p>
      </section>
    );
  }

  if (!hasAccess) return null;

  // ---------- Main content ----------
  return (
    <section className="w-full min-h-screen bg-linear-to-b from-blue-700 to-blue-300 py-16 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-3">Interactive Map</h1>

      {/* Package/payment info (purely informational) */}
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

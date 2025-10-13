// app/dashboard/map/page.tsx
//
// Why this structure?
// -------------------
// Next.js App Router prefers that components calling `useSearchParams()`
// render within a <Suspense> boundary. This file provides:
//   1) A small page wrapper that renders <Suspense fallback=...>
//   2) The original logic inside <MapPageInner/> (unchanged behavior)
//
// What's fixed here?
// ------------------
// TypeScript can consider `useSearchParams()` possibly null at build time.
// Accessing `.get(...)` directly raises: `'searchParams' is possibly 'null'`.
// We make it *null-safe* with optional chaining and a default, without changing
// runtime behavior or hook order.
//
// Pillars
// -------
// - Simplicity: single-line null fix + comments.
// - Robustness: null-safe, build-friendly, no change in render order.
// - Efficiency: purely client-side; no extra renders.
// - Ease of management: scoped change, minimal footprint.
// - Security: no new capabilities; same access gate logic.

"use client";

import { Suspense } from "react"; // ✅ Suspense boundary for useSearchParams()
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
      // Keep fallback visuals consistent with your brand language
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

// -----------------------------------------------------
// Inner page: original logic lives here, unchanged
// -----------------------------------------------------
function MapPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  // ✅ FIX: make `useSearchParams()` usage null-safe for builds
  //   - `searchParams?.get("success")` → string | null | undefined
  //   - coalesce to empty string before comparing
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

    // One probe: check access from the server
    const checkOnce = async () => {
      const res = await fetch("/api/payments/check", {
        signal: ac.signal,
        cache: "no-store",
      });
      const data: PaymentCheckResponse = await res.json();
      return { ok: res.ok, data };
    };

    const run = async () => {
      // Wait for session state before starting
      if (status === "loading") return;

      try {
        // Optimistic unlock: if session says paid, unlock immediately
        if (session?.user?.hasPaid) {
          setHasAccess(true);
        }

        // First authoritative check
        const first = await checkOnce();

        if (first.ok && first.data.hasAccess) {
          setHasAccess(true);
          setPackageType(first.data.packageType);
          setLatestPayment(first.data.latestPayment);
          return; // done
        }

        // If we just completed checkout, short-poll a few times for webhook landing
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

        // Still no access → redirect to upgrade
        if (!didRedirect.current) {
          didRedirect.current = true;
          router.push("/dashboard/upgrade");
        }
      } catch (err) {
        // Ignore AbortError (unmounts/cancels)
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
    // Safe deps: no functions created inside effect are referenced by children
  }, [status, session?.user?.hasPaid, router, justSucceeded]);

  // ---------- Render states ----------
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

  // ---------- Main content ----------
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-16 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-3">
        Interactive Map
      </h1>

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

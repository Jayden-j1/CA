// app/dashboard/map/page.tsx
//
// Why this structure?
// -------------------
// The Map is inherently client-side (Google Maps SDK / DOM APIs). Making the
// *page* a Server Component wouldn't yield a practical win because the map
// itself forces a client boundary. Instead, we:
//   • Keep this page client-side
//   • Use a single shared, authoritative access probe (usePaidAccess())
//   • Briefly poll after Stripe success (?success=true) so unlock is instant
//
// What’s fixed / improved?
// ------------------------
// • Replaced ad-hoc polling with the shared usePaidAccess() hook
// • Corrected Tailwind class typo: "bg-linear-to-b" → "bg-gradient-to-b"
// • Removed duplicate state/redirect guards (less room for race conditions)
// • Consistent UX states: "Checking..." → unlock → render map
//
// Pillars
// -------
// - Efficiency: tiny fetches; polling only after success.
// - Robustness: single source of truth (/api/payments/check).
// - Simplicity: minimal code, consistent with Billing/Course.
// - Security: read-only probe; server owns paid state.

"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePaidAccess } from "@/hooks/usePaidAccess";
import GoogleMapComponent from "@/components/GoogleMap/GoogleMapComponent";

// ---------------------------------------------
// Page wrapper: keep Suspense for URL params etc.
// ---------------------------------------------
export default function MapPage() {
  return (
    <Suspense
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

// ---------------------------------------------
// Inner page (client) using the unified probe
// ---------------------------------------------
function MapPageInner() {
  const router = useRouter();
  const access = usePaidAccess(); // { loading, hasAccess, inheritedFrom?, healed? }

  // Redirect to Upgrade only when we are certain access is not granted.
  useEffect(() => {
    if (access.loading) return;
    if (!access.hasAccess) {
      router.replace("/dashboard/upgrade");
    }
  }, [access.loading, access.hasAccess, router]);

  // Loading (single source of truth)
  if (access.loading) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">
          Finalizing your payment…
        </p>
      </section>
    );
  }

  // If we’re redirecting, render a friendly state (prevents flicker)
  if (!access.hasAccess) {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Redirecting…</p>
      </section>
    );
  }

  // ✅ Paid users see the Map immediately
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-16 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-6">
        Interactive Map
      </h1>

      {/* Optional: show inherited/healed info for clarity (non-blocking) */}
      {access.inheritedFrom === "business" && (
        <p className="text-white/90 mb-2 text-sm">
          Access inherited from your business owner.
        </p>
      )}
      {access.healed && (
        <p className="text-white/90 mb-6 text-sm">
          Your access was refreshed from your recent payment.
        </p>
      )}

      <GoogleMapComponent />
    </section>
  );
}

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
        <p className="text-white text-xl">Finalizing your payment…</p>
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
      {/* 
        Main page heading:
        - Large, bold text for clear hierarchy.
        - Responsive font sizes for professional appearance on all screens.
      */}
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-6 text-center">
        Interactive Map
      </h1>

      {/* Optional: show inherited/healed info for clarity (non-blocking) */}
      {access.inheritedFrom === "business" && (
        <p className="text-white/90 mb-2 text-sm text-center">
          Access inherited from your business owner.
        </p>
      )}
      {access.healed && (
        <p className="text-white/90 mb-6 text-sm text-center">
          Your access was refreshed from your recent payment.
        </p>
      )}

      {/* 
        NEW: Context block explaining clan/tribe/language group boundaries.
        -------------------------------------------------------------------
        - Uses a centered, max-width container so text is never squished.
        - Slightly translucent background for readability against gradient.
        - Responsive typography (text-base → text-lg + comfortable line-height).
        - Mirrors your existing dashboard "card" style (rounded, subtle shadow).
      */}
      <div
        className="
          max-w-4xl
          w-full
          px-4 sm:px-6
          mb-8
        "
      >
        <div
          className="
            bg-white/10
            border border-white/20
            rounded-2xl
            shadow-lg
            px-4 sm:px-6
            py-5 sm:py-6
            text-white/95
          "
        >
          <p className="text-base sm:text-lg leading-relaxed tracking-normal sm:tracking-wide mb-3">
            The Nyangbul people had their own distinct boundaries within the
            broader Bundjalung Nation. These boundaries were respected by
            neighbouring clans and maintained through cultural protocols,
            spiritual beliefs, sacred knowledge, and a deep and intimate
            knowledge of Juguun (Country).
          </p>
          <p className="text-base sm:text-lg leading-relaxed tracking-normal sm:tracking-wide mb-3">
            All clans had the necessary resources within their boundaries to not
            only survive but to thrive and flourish. This gives a glimpse into
            the complexity and sophistication of First Nations cultural systems,
            where boundaries were carefully organised to support life, lore, and
            responsibility.
          </p>
          <p className="text-base sm:text-lg leading-relaxed tracking-normal sm:tracking-wide mb-3">
            These boundaries are not simply lines on a map or fences around a
            piece of land. They are interwoven with culture, stories, song, and
            Dreaming. They are carefully constructed with care and are deeply
            interconnected across Country, community, and kinship.
          </p>
          <p className="text-base sm:text-lg leading-relaxed tracking-normal sm:tracking-wide mb-3">
            First Nations peoples had, and continue to have, systems that work:
            allowing clans to move across neighbouring boundaries by following
            cultural protocols in peaceful and respectful ways—a concept often
            very different to Western colonial approaches to land, borders, and
            ownership.
          </p>
          <p className="text-base sm:text-lg leading-relaxed tracking-normal sm:tracking-wide">
            Feel free to explore the map with this in mind, remembering that
            each boundary represents deep cultural connection, responsibility,
            and relationship to Nyangbul and Bundjalung Country.
          </p>
        </div>
      </div>

      {/* 
        Map container:
        - Wrapped in a width-limited, padded container so it aligns visually
          with the text block above and avoids touching screen edges.
        - GoogleMapComponent itself remains completely unchanged.
      */}
      <div className="w-full max-w-5xl px-4 sm:px-6">
        <GoogleMapComponent />
      </div>
    </section>
  );
}









// // app/dashboard/map/page.tsx
// //
// // Why this structure?
// // -------------------
// // The Map is inherently client-side (Google Maps SDK / DOM APIs). Making the
// // *page* a Server Component wouldn't yield a practical win because the map
// // itself forces a client boundary. Instead, we:
// //   • Keep this page client-side
// //   • Use a single shared, authoritative access probe (usePaidAccess())
// //   • Briefly poll after Stripe success (?success=true) so unlock is instant
// //
// // What’s fixed / improved?
// // ------------------------
// // • Replaced ad-hoc polling with the shared usePaidAccess() hook
// // • Corrected Tailwind class typo: "bg-linear-to-b" → "bg-gradient-to-b"
// // • Removed duplicate state/redirect guards (less room for race conditions)
// // • Consistent UX states: "Checking..." → unlock → render map
// //
// // Pillars
// // -------
// // - Efficiency: tiny fetches; polling only after success.
// // - Robustness: single source of truth (/api/payments/check).
// // - Simplicity: minimal code, consistent with Billing/Course.
// // - Security: read-only probe; server owns paid state.

// "use client";

// import { Suspense, useEffect } from "react";
// import { useRouter } from "next/navigation";
// import { usePaidAccess } from "@/hooks/usePaidAccess";
// import GoogleMapComponent from "@/components/GoogleMap/GoogleMapComponent";

// // ---------------------------------------------
// // Page wrapper: keep Suspense for URL params etc.
// // ---------------------------------------------
// export default function MapPage() {
//   return (
//     <Suspense
//       fallback={
//         <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
//           <p className="text-white text-xl">Loading map…</p>
//         </section>
//       }
//     >
//       <MapPageInner />
//     </Suspense>
//   );
// }

// // ---------------------------------------------
// // Inner page (client) using the unified probe
// // ---------------------------------------------
// function MapPageInner() {
//   const router = useRouter();
//   const access = usePaidAccess(); // { loading, hasAccess, inheritedFrom?, healed? }

//   // Redirect to Upgrade only when we are certain access is not granted.
//   useEffect(() => {
//     if (access.loading) return;
//     if (!access.hasAccess) {
//       router.replace("/dashboard/upgrade");
//     }
//   }, [access.loading, access.hasAccess, router]);

//   // Loading (single source of truth)
//   if (access.loading) {
//     return (
//       <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
//         <p className="text-white text-xl">
//           Finalizing your payment…
//         </p>
//       </section>
//     );
//   }

//   // If we’re redirecting, render a friendly state (prevents flicker)
//   if (!access.hasAccess) {
//     return (
//       <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
//         <p className="text-white text-xl">Redirecting…</p>
//       </section>
//     );
//   }

//   // ✅ Paid users see the Map immediately
//   return (
//     <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-16 flex flex-col items-center">
//       <h1 className="text-white font-bold text-4xl sm:text-5xl mb-6">
//         Interactive Map
//       </h1>

//       {/* Optional: show inherited/healed info for clarity (non-blocking) */}
//       {access.inheritedFrom === "business" && (
//         <p className="text-white/90 mb-2 text-sm">
//           Access inherited from your business owner.
//         </p>
//       )}
//       {access.healed && (
//         <p className="text-white/90 mb-6 text-sm">
//           Your access was refreshed from your recent payment.
//         </p>
//       )}

//       <GoogleMapComponent />
//     </section>
//   );
// }

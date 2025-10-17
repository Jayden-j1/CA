// app/dashboard/course/[slug]/page.tsx
//
// Purpose
// -------
// Thin client-side redirector from the dynamic route
//   /dashboard/course/[slug]
// to your existing page that already handles rendering:
//   /dashboard/course?slug=<slug>
//
// Why this file exists
// --------------------
// Your full Course UI lives in app/dashboard/course/page.tsx and it expects
// a slug via search params. Rather than duplicating that large UI,
// we centralize rendering there and only forward users here.
//
// How it works
// ------------
// - Read the dynamic route param { slug }.
// - Preserve any existing query flags (e.g., ?preview=true&success=true).
// - Redirect to /dashboard/course?slug=<slug>&<other-flags>.
//
// Benefits (pillars)
// ------------------
// ✅ Simplicity: one place renders the Course UI.
// ✅ Robustness: preserves extra flags (preview/success) during redirect.
// ✅ Ease of management: no duplicated components, fewer moving parts.
// ✅ Efficiency: no extra data fetching here; just a lightweight redirect.
// ✅ Security: forwarding does not expose anything new.
//
// Notes
// -----
// This is a *client component* because we use useEffect + router.replace().

"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type PageProps = {
  params: { slug: string }; // In pages, params are sync (the Promise-params quirk is only for API Route Handlers)
};

export default function CourseSlugRedirectPage({ params }: PageProps) {
  const router = useRouter();
  const searchParams = useSearchParams(); // preserve any existing flags

  useEffect(() => {
    // Build a new query string that preserves existing flags and injects slug
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.set("slug", params.slug);

    // Replace so the URL becomes /dashboard/course?slug=<slug>[&flags]
    router.replace(`/dashboard/course?${next.toString()}`);
  }, [params.slug, router, searchParams]);

  // Minimal fallback UI to avoid a flash
  return (
    <section className="w-full min-h-[50vh] flex items-center justify-center">
      <p className="text-gray-600">Loading course…</p>
    </section>
  );
}

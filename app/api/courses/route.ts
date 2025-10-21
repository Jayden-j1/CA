// app/api/courses/route.ts
//
// Purpose
// -------
// Return a minimal list of courses for dashboards.
// Uses Next.js cache tags + optional ISR for fast On-Demand Revalidation (ODR).
//
// Tags used
// ----------
// - "courses:list" (canonical tag for the course list)
//   Revalidated via /api/revalidate whenever a course/module/lesson is published.
//
// Notes
// ------
// - Sanity-only (published) reads (no drafts) for stable production output.
// - IMPORTANT: Our fetchSanity helper accepts `tags` and `revalidate` directly
//   (top-level on the 3rd argument), not nested under a `fetch` key.
//   This fixes: “'fetch' does not exist in type 'FetchInit'” and
//   “'next' does not exist in type 'FetchInit'”.
//
// Pillars
// --------
// ✅ Efficiency  – cached, tag-based ODR for instant freshness
// ✅ Robustness  – strict published perspective, defensive error handling
// ✅ Simplicity  – minimal logic, one clean endpoint
// ✅ Ease of mgmt – one canonical source for the course list
// ✅ Security    – server-side Sanity access only

import { NextResponse } from "next/server";
import { fetchSanity } from "@/lib/sanity/client";
import { COURSE_LIST_QUERY } from "@/lib/sanity/queries";

// Optional ISR interval (hybrid with ODR). Remove if you prefer ODR-only.
export const revalidate = 60;

export async function GET() {
  try {
    // 🧠 Type hint: matches query shape (id, slug, title)
    type CourseSummary = { id: string; slug: string; title: string };

    // ✅ Correct usage of our helper:
    // - `tags`: Next.js cache tag for ODR
    // - `revalidate`: optional ISR window
    // - `perspective: 'published'`: Sanity read without drafts
    const courses = await fetchSanity<CourseSummary[]>(
      COURSE_LIST_QUERY,
      undefined,
      {
        tags: ["courses:list"],    // <— cache tag for list ODR
        revalidate,                // <— optional ISR (60s)
        perspective: "published",  // <— Sanity: no drafts
      }
    );

    return NextResponse.json({ courses });
  } catch (err) {
    console.error("[GET /api/courses] Error:", err);
    return NextResponse.json(
      { error: "Failed to load courses" },
      { status: 500 }
    );
  }
}

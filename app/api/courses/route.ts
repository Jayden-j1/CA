// app/api/courses/route.ts
//
// Purpose
// -------
// Return a minimal list of courses for dashboards.
// Now with Next.js cache tags for instant ODR via /api/revalidate.
//
// Tags used
// ---------
// - "courses:list" (the canonical tag for the list)
//   Revalidated by /api/revalidate on any course/module/lesson publish.
//
// Notes
// -----
// - Uses Sanity-only (published) reads.
// - If you want preview, you can add a ?preview=true param and set
//   perspective: 'previewDrafts' (omitted here on purpose).

import { NextResponse } from "next/server";
import { fetchSanity } from "@/lib/sanity/client";
import { COURSE_LIST_QUERY } from "@/lib/sanity/queries";

export const revalidate = 60; // ISR (optional). You can remove if you prefer full-cache + ODR only.

export async function GET() {
  try {
    const courses = await fetchSanity<
      { id: string; slug: string; title: string }[]
    >(COURSE_LIST_QUERY, undefined, {
      // ✅ Attach a stable tag so we can revalidate from the webhook
      next: { tags: ["courses:list"] },
      // optional: revalidate at most every minute (hybrid ISR + ODR)
      revalidate,
      perspective: "published",
    });

    return NextResponse.json({ courses });
  } catch (err) {
    console.error("[GET /api/courses] Error:", err);
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 });
  }
}

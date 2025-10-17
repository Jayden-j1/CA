// app/api/courses/route.ts
//
// ============================================================
// Course List (Sanity → Published Only)
// ------------------------------------------------------------
// Purpose
//   Small, fast list for dashboard pickers and defaults.
//   Always reads from Sanity (published only) — no Prisma here.
//
// Why this design
//   • Production-ready: cached for 60s (ISR) with SWR fallback
//   • Simplicity: one query (COURSE_LIST_QUERY)
//   • Security: exposes only minimal metadata
//
// Pillars
//   ✅ Efficiency   – minimal fields, CDN + ISR cache
//   ✅ Robustness   – no Prisma dependency; clear error handling
//   ✅ Simplicity   – tiny DTO for list UIs
//   ✅ Security     – published content only
//   ✅ Ease of mgmt – single GROQ query used everywhere
// ============================================================

import { NextResponse } from "next/server";
import { fetchSanity } from "@/lib/sanity/client";
import { COURSE_LIST_QUERY } from "@/lib/sanity/queries";

// Route segment caching (Next.js Data Cache)
// • Revalidate this route’s response every 60s.
// • Also set an explicit Cache-Control for proxies/CDN.
export const revalidate = 60;

// Note: route handlers do not require the "promisified params" signature;
// that's for *pages*. Keeping standard (req: Request) form here.
export async function GET() {
  try {
    // 👇 We request published content (default perspective) — no drafts.
    //    No query interpolation: parameters are passed (none here).
    const courses = await fetchSanity(COURSE_LIST_QUERY);

    // Add explicit cache headers for proxies and browsers.
    const headers = {
      // 60s fresh in edge/CDN; allow 5min SWR
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    };

    return NextResponse.json({ courses }, { headers });
  } catch (err) {
    console.error("[GET /api/courses] Error:", err);
    // No internals leaked; caller can decide fallback (e.g., local placeholder)
    return NextResponse.json({ courses: [] }, { status: 200 });
  }
}

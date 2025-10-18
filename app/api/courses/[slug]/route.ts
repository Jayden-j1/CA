// app/api/courses/[slug]/route.ts
//
// Purpose
// -------
// Return 1 course (published) by slug in a consistent DTO shape.
// Adds Next.js cache tags so our ODR endpoint can invalidate this
// exact course when related content changes.
//
// Tags
// ----
// - `course:<slug>`   → specific course detail
// - `courses:list`    → coarse list (in case metadata changes)
//
// Notes
// -----
// - If you have your flattening function already, keep it.
// - We assume your GROQ returns the hierarchical structure and
//   your UI can work with the flattened modules (if you flatten here).

import { NextResponse } from "next/server";
import { fetchSanity } from "@/lib/sanity/client";
import { COURSE_DETAIL_BY_SLUG } from "@/lib/sanity/queries";

// Keep your existing flattenModules() if you need a flat modules[] shape.
// (Omitted here for brevity—you can keep your current implementation.)

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> } // ✅ Next 15 typed contract
) {
  try {
    const { slug } = await ctx.params;

    const doc = await fetchSanity<any>(
      COURSE_DETAIL_BY_SLUG,
      { slug },
      {
        // ✅ Attach both tags so /api/revalidate can target this resource
        next: { tags: [`course:${slug}`, "courses:list"] },
        // You can keep ISR if you like hybrid caching:
        revalidate: 60,
        perspective: "published",
      }
    );

    if (!doc) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // If you flatten nested modules here, call your existing helper:
    // const modules = flattenModules(doc.modules || []);
    // return NextResponse.json({ course: { ...doc, modules } });

    return NextResponse.json({ course: doc });
  } catch (err) {
    console.error("[GET /api/courses/[slug]] Error:", err);
    return NextResponse.json({ error: "Failed to load course" }, { status: 500 });
  }
}

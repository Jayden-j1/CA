// app/api/courses/route.ts
//
// Purpose
// -------
// Returns a list of courses for the dashboard.
// - If preview mode is active (draftMode + ?preview=true): fetch from Sanity (includes drafts).
// - Otherwise: fetch from Prisma (published only).
//
// Design Pillars
// --------------
// ✅ Efficiency  – Select minimal fields; small normalized payload.
// ✅ Robustness  – Graceful fallback if Sanity is unavailable or empty.
// ✅ Simplicity  – Linear control flow and clear data mapping.
// ✅ Ease of Management – Easily extendable for pagination/filtering.
// ✅ Security    – Drafts only accessible when preview mode + secret enabled.
//

import { NextResponse } from "next/server";
import { draftMode } from "next/headers"; // Provides draft/preview mode state
import { prisma } from "@/lib/prisma"; // Local Prisma client for database access
import { fetchSanity } from "@/lib/sanity/client"; // Helper for GROQ queries

// Prevent route from being statically cached (always dynamic)
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // Parse URL for query params (?preview=true, etc.)
    const { searchParams } = new URL(req.url);
    const previewFlag = searchParams.get("preview") === "true";

    // 🧠 FIXED:
    // draftMode() is async in Next.js 15 → must await
    const { isEnabled: draftEnabled } = await draftMode();

    // ------------------------------
    // Helper: normalize Sanity course
    // ------------------------------
    const mapSanityCourse = (c: any) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      summary: c.summary ?? null,
      coverImage: c.coverImage ?? null,
      createdAt: c.createdAt ?? null,
      moduleCount: c.moduleCount ?? 0,
    });

    // 1️⃣ Preview Mode → fetch from Sanity (drafts visible)
    if (previewFlag && draftEnabled) {
      try {
        const query = /* groq */ `
          *[_type == "course" && defined(slug.current)]{
            "id": _id,
            "slug": slug.current,
            title,
            summary,
            "coverImage": select(defined(coverImage.asset->url) => coverImage.asset->url, null),
            "createdAt": _createdAt,
            "moduleCount": count(modules[])
          } | order(_createdAt desc)
        `;

        const sanityCourses = await fetchSanity<any[]>(
          query,
          {},
          { perspective: "previewDrafts" }
        );

        if (Array.isArray(sanityCourses) && sanityCourses.length > 0) {
          return NextResponse.json({
            courses: sanityCourses.map(mapSanityCourse),
          });
        }
      } catch (e) {
        console.warn("[/api/courses] Sanity preview fetch failed; falling back to Prisma:", e);
      }
    }

    // 2️⃣ Default Path → Prisma (published-only)
    const courses = await prisma.course.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        coverImage: true,
        createdAt: true,
        modules: { where: { isPublished: true }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Normalize Prisma response to match the frontend DTO
    const data = courses.map((c) => ({
      ...c,
      moduleCount: c.modules.length,
    }));

    return NextResponse.json({ courses: data });
  } catch (err) {
    console.error("[GET /api/courses] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

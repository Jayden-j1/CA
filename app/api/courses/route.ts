// app/api/courses/route.ts
//
// Purpose
// -------
// Public course catalog endpoint that returns *published* courses only,
// including a lightweight moduleCount for the UI to render badges or stats.
//
// Why this shape?
// ---------------
// Your dashboard (and /dashboard/course loader) primarily needs the course `slug`
// to fetch course details, plus a handful of fields for display. We avoid
// over-fetching and compute moduleCount cheaply by selecting only module IDs.
//
// Pillars
// -------
// - Simplicity: one query with a small `select` footprint.
// - Efficiency: returns only published courses; no large payloads.
// - Robustness: explicit mapping, defensive defaults, clear error handling.
// - Ease of management: comments + predictable DTO.
// - Security: no private data; catalog is read-only.
// - Best practices: force-dynamic to reflect latest publish states, no cache.
//

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// In App Router, this ensures the route is evaluated dynamically (no static cache).
// This matters for “isPublished” changes you want reflected immediately.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1) Fetch only published courses with the minimal fields your UI needs.
    //    We also select published module IDs so we can compute a moduleCount
    //    without transferring entire module records.
    const rows = await prisma.course.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        coverImage: true,
        createdAt: true,
        modules: {
          where: { isPublished: true },
          select: { id: true }, // lightweight for count
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2) Map DB rows to a stable DTO for the client.
    //    Keeping this explicit makes it safe to evolve your schema later.
    const courses = rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      summary: c.summary ?? null,
      coverImage: c.coverImage ?? null,
      createdAt: c.createdAt,
      moduleCount: c.modules.length, // count published modules
    }));

    // 3) Return JSON with no implicit caching (client fetches already used no-store).
    return NextResponse.json({ courses }, { status: 200 });
  } catch (err) {
    // Centralized logging so operational issues don’t leak to clients.
    console.error("[GET /api/courses] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

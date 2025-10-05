// app/api/courses/route.ts
//
// Purpose
// -------
// Returns a public list of *published* courses for display in the dashboard.
// Each course summary includes:
//   - id, slug, title, summary, coverImage, createdAt
//   - moduleCount (number of published modules)
//
// Notes
// ------
// - Only published courses are exposed (security).
// - Selects only fields used by your UI (efficiency).
// - Orders newest-first (ease of management for admins).
// - Fully typed and schema-safe (robustness).
//
// Pillars
// -------
// - Efficiency: Small select query with pre-counted modules.
// - Robustness: Safe try/catch and clear JSON error responses.
// - Simplicity: One function (GET) with no branching logic.
// - Ease of Management: Easy to expand later (add pagination/filtering).
// - Security: Returns only published courses, never drafts.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // 1️⃣ Fetch all *published* courses
    //    Select minimal fields for dashboard listing
    const courses = await prisma.course.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        coverImage: true,
        createdAt: true,
        // Pull related modules only to count them
        modules: {
          where: { isPublished: true },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2️⃣ Transform results into a simple DTO for the frontend
    const data = courses.map((course) => ({
      id: course.id,
      slug: course.slug,
      title: course.title,
      summary: course.summary,
      coverImage: course.coverImage,
      createdAt: course.createdAt,
      moduleCount: course.modules.length, // count of published modules
    }));

    // 3️⃣ Return normalized JSON payload
    return NextResponse.json({ courses: data });
  } catch (err) {
    console.error("[GET /api/courses] Error:", err);

    // 4️⃣ Graceful failure response
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

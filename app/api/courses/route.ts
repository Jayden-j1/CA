// app/api/courses/route.ts
//
// Purpose:
// - Public course catalog endpoint (lists only published courses).
// - Includes moduleCount for quick UI rendering.
// - No auth required to *view the list* (you can lock this down if desired).
//
// Pillars:
// - Simplicity: single lightweight query.
// - Efficiency: select only fields needed by UI.
// - Security: returns only published courses.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const courses = await prisma.course.findMany({
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
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = courses.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      summary: c.summary,
      coverImage: c.coverImage,
      createdAt: c.createdAt,
      moduleCount: c.modules.length,
    }));

    return NextResponse.json({ courses: data });
  } catch (err) {
    console.error("[GET /api/courses] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// app/api/courses/[slug]/route.ts
//
// Purpose
// -------
// Return a single *published* course by slug in the normalized DTO your UI expects.
// For now, we only read models that exist in your Prisma client today:
//   • Course
//   • CourseModule
// and we return `lessons: []` as placeholders (your UI already tolerates this).
//
// Why this change?
// ----------------
// Your previous build errors show Prisma does NOT expose `courseLesson` or
// `quizQuestion`. Until those tables/models exist, attempting to query them
// causes type errors. This version removes those queries and compiles cleanly.
//
// Phase 2
// -------
// When you add Lesson/Quiz tables, simply extend this handler to fetch them and
// populate `lessons` (and `quiz`) instead of leaving them empty.
//
// Pillars
// -------
// - Simplicity: only query models that exist today.
// - Robustness: strict 404 on missing/hidden course; clear error handling.
// - Efficiency: select only fields you render.
// - Ease of management: one DTO assembly point, easy to extend later.
// - Security: returns only published content.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  try {
    // 1) Load the published course by slug (no nested includes to avoid schema coupling)
    const course = await prisma.course.findFirst({
      where: { slug: params.slug, isPublished: true },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        coverImage: true,
        createdAt: true,
        updatedAt: true,
        isPublished: true,
      },
    });

    if (!course) {
      // Hidden or does not exist
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // 2) Load all published modules for the course (ordered)
    //    NOTE: We only query CourseModule because this model is confirmed to exist.
    const modules = await prisma.courseModule.findMany({
      where: { courseId: course.id, isPublished: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
      },
    });

    // 3) Assemble the DTO. We intentionally return `lessons: []` for now so the
    //    shape matches your frontend expectations without requiring tables that
    //    aren’t in your schema yet.
    const mappedModules = modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description ?? undefined,
      lessons: [] as Array<{
        id: string;
        title: string;
        videoUrl: string;
        body?: string;
        quiz?: {
          questions: Array<{
            id: string;
            question: string;
            options: string[];
            correctIndex: number;
          }>;
        };
      }>,
    }));

    const dto = {
      id: course.id,
      slug: course.slug,
      title: course.title,
      summary: course.summary,
      coverImage: course.coverImage,
      modules: mappedModules,
    };

    return NextResponse.json({ course: dto });
  } catch (err) {
    console.error("[GET /api/courses/[slug]] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

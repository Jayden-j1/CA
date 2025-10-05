// app/api/courses/progress/route.ts
//
// Purpose:
// - GET: return current user's progress for a course (by ?course=<slug>).
// - POST: upsert module progress for current user, then recompute course progress.
//         Body supports either courseId or courseSlug, plus moduleId updates.
//
// Security:
// - Requires authenticated, active user with COURSE access (PACKAGE or STAFF_SEAT).
//
// Data shape (POST):
// {
//   "courseSlug": "cultural-awareness-basics", // OR "courseId": "<id>"
//   "moduleId": "<module-id>",
//   "completed": true,                // optional (defaults to false)
//   "quizScore": 80                   // optional
// }
//
// Pillars:
// - Simplicity: single endpoint to mark module completion and update course percent.
// - Robustness: all IDs validated; unique constraints keep data clean.
// - Efficiency: minimal roundtrips, server computes percent with cheap counts.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// -------------------------
// GET /api/courses/progress?course=<slug>
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const courseSlug = url.searchParams.get("course");
    if (!courseSlug) {
      return NextResponse.json({ error: "Missing ?course=<slug>" }, { status: 400 });
    }

    const course = await prisma.course.findUnique({
      where: { slug: courseSlug },
      select: { id: true, slug: true, title: true, isPublished: true },
    });
    if (!course || !course.isPublished) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Access check
    const canAccess = await hasCourseAccess(userId);
    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Course-level progress
    const courseProgress = await prisma.userCourseProgress.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
    });

    // Module-level progress (handy for client UIs)
    const moduleProgress = await prisma.userModuleProgress.findMany({
      where: {
        userId,
        module: { courseId: course.id },
      },
      select: {
        moduleId: true,
        completed: true,
        quizScore: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      course: { id: course.id, slug: course.slug, title: course.title },
      courseProgress,
      moduleProgress,
    });
  } catch (err) {
    console.error("[GET /api/courses/progress] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// -------------------------
// POST /api/courses/progress
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Accept either courseId or courseSlug (prefer slug for DX)
    const courseSlug: string | undefined = body.courseSlug;
    const courseIdBody: string | undefined = body.courseId;
    const moduleId: string | undefined = body.moduleId;
    const completed: boolean = Boolean(body.completed ?? false);
    const quizScore: number | null =
      typeof body.quizScore === "number" ? body.quizScore : null;

    if (!moduleId) {
      return NextResponse.json({ error: "Missing moduleId" }, { status: 400 });
    }

    // Resolve courseId
    let courseId: string | null = null;
    if (courseIdBody) {
      courseId = courseIdBody;
    } else if (courseSlug) {
      const course = await prisma.course.findUnique({
        where: { slug: courseSlug },
        select: { id: true },
      });
      if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
      courseId = course.id;
    } else {
      // derive from module if neither provided
      const mod = await prisma.courseModule.findUnique({
        where: { id: moduleId },
        select: { courseId: true },
      });
      if (!mod) return NextResponse.json({ error: "Module not found" }, { status: 404 });
      courseId = mod.courseId;
    }

    // Access check
    const canAccess = await hasCourseAccess(userId);
    if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Validate module belongs to the course
    const moduleRec = await prisma.courseModule.findFirst({
      where: { id: moduleId, courseId },
      select: { id: true, courseId: true },
    });
    if (!moduleRec) {
      return NextResponse.json({ error: "Module not in course" }, { status: 400 });
    }

    // 1) Upsert per-module progress
    await prisma.userModuleProgress.upsert({
      where: { userId_moduleId: { userId, moduleId } },
      create: { userId, moduleId, completed, quizScore: quizScore ?? undefined },
      update: { completed, quizScore: quizScore ?? undefined },
    });

    // 2) Recompute course-level progress
    const [totalModules, completedModulesForUser] = await Promise.all([
      prisma.courseModule.count({ where: { courseId, isPublished: true } }),
      prisma.userModuleProgress.count({
        where: { userId, completed: true, module: { courseId } },
      }),
    ]);

    const completedModuleIds = await prisma.userModuleProgress.findMany({
      where: { userId, completed: true, module: { courseId } },
      select: { moduleId: true },
      orderBy: { updatedAt: "desc" },
    });

    const percent =
      totalModules > 0 ? Math.round((completedModulesForUser / totalModules) * 100) : 0;

    await prisma.userCourseProgress.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: {
        userId,
        courseId,
        lastModuleId: moduleId,
        completedModuleIds: completedModuleIds.map((m) => m.moduleId),
        percent,
      },
      update: {
        lastModuleId: moduleId,
        completedModuleIds: completedModuleIds.map((m) => m.moduleId),
        percent,
      },
    });

    return NextResponse.json({
      ok: true,
      percent,
      totalModules,
      completedModules: completedModulesForUser,
    });
  } catch (err) {
    console.error("[POST /api/courses/progress] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---- helpers ----

async function hasCourseAccess(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });
  if (!user || user.isActive === false) return false;

  const payment = await prisma.payment.findFirst({
    where: {
      userId,
      OR: [{ purpose: "PACKAGE" }, { purpose: "STAFF_SEAT" }],
    },
    select: { id: true },
  });

  return Boolean(payment);
}

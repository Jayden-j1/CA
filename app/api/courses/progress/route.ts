// app/api/courses/progress/route.ts
//
// Purpose
// -------
// Read/write user course progress against your *actual* Prisma model
// `userCourseProgress` (NOT the previously suggested fields).
//
// Current Model Fields (from your error types)
// -------------------------------------------
// id, createdAt, updatedAt, userId, courseId,
// completedModuleIds: string[],
// lastModuleId: string | null,
// percent: number | null
//
// Strategy
// --------
// - GET: Return `progress: null` (so the client keeps using local fallback)
//        *plus* a `meta` object with `percent` and `completedModuleIds` that you
//        can start displaying later if you want — without breaking existing UI.
// - POST: Upsert a row, but only write supported fields. Because your frontend
//         currently posts indices/answers (which aren't in your model), we
//         ignore them for now and store safe defaults. This removes errors and
//         is forward-compatible.
//
// Pillars
// -------
// - Security: Auth required.
// - Simplicity: Strictly use fields your model actually has.
// - Robustness: Handles absent records gracefully.
// - Ease of management: You can evolve the payload later with minimal risk.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// -------------------- GET: return read-only progress meta --------------------
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");
  if (!courseId) {
    return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
  }

  try {
    const rec = await prisma.userCourseProgress.findFirst({
      where: { userId: session.user.id, courseId },
      select: {
        // ✅ only fields that exist on your model
        completedModuleIds: true,
        lastModuleId: true,
        percent: true,
      },
    });

    // Your current /dashboard/course/page.tsx expects:
    //   { progress: { currentModuleIndex, currentLessonIndex, answers } | null }
    // Because your model does not include those fields, we return `progress: null`
    // to keep the page on its local fallback (which you already implemented).
    return NextResponse.json({
      progress: null,
      meta: rec
        ? {
            percent: rec.percent ?? null,
            completedModuleIds: rec.completedModuleIds ?? [],
            lastModuleId: rec.lastModuleId ?? null,
          }
        : null,
    });
  } catch (err) {
    console.error("[GET /api/courses/progress] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// -------------------- POST: upsert safe progress snapshot --------------------
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // We currently receive indices/answers from the client, but your model
    // doesn't store them. We'll accept them for *future use* but only write
    // fields that exist today to avoid type errors.
    const courseId = String(body?.courseId || "");
    if (!courseId) {
      return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
    }

    // Write only supported fields (safe defaults):
    // - Keep completedModuleIds as-is if you later pass real IDs in body,
    //   else default to [] (non-breaking).
    const completedModuleIds: string[] = Array.isArray(body?.completedModuleIds)
      ? body.completedModuleIds.filter((s: unknown) => typeof s === "string")
      : [];

    // Optional hints (ignored if not provided)
    const lastModuleId: string | null =
      typeof body?.lastModuleId === "string" ? body.lastModuleId : null;

    const percent: number | null =
      typeof body?.percent === "number" && body.percent >= 0 && body.percent <= 100
        ? Math.round(body.percent)
        : null;

    await prisma.userCourseProgress.upsert({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId,
        },
      },
      update: {
        completedModuleIds,
        lastModuleId,
        percent,
      },
      create: {
        userId: session.user.id,
        courseId,
        completedModuleIds,
        lastModuleId,
        percent,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/courses/progress] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

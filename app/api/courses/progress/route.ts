// app/api/courses/progress/route.ts
//
// Purpose
// -------
// Server endpoint for *engagement-first* course progress.
// We do NOT score quizzes; we simply persist high-level completion metadata
// using the fields that EXIST in your Prisma schema today:
//   - UserCourseProgress: { completedModuleIds: string[], lastModuleId: string | null, percent: number | null }
//
// Why this design?
// ----------------
// Your current frontend (dashboard/course/page.tsx) tracks granular UI state
// (currentModuleIndex, currentLessonIndex, answers) in localStorage and POSTs
// them. Because your Prisma model does not (yet) have those fields, this API
// **accepts** them for forward compatibility but **does not persist** them.
// Instead, we persist *supported* fields (completedModuleIds, lastModuleId,
// percent), keeping DB as the source of truth for overall completion.
// The page continues to work: if `progress` is null, it uses its local fallback.
//
// Certificate readiness
// ---------------------
// We set/maintain `percent` server-side. In Phase 2.3 you can:
//   - trigger "completed" when percent === 100
//   - generate/store a PDF certificate
//
// Pillars
// -------
// - Security: Auth required; users can only read/write their own progress.
// - Robustness: Defensive parsing; safe defaults; error handling.
// - Efficiency: Minimal reads; single upsert.
// - Simplicity: Only write fields your schema actually has.
// - Ease of management: Extensively commented; DTO is stable & small.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Helper: Clamp integer to [0, 100]
const clampPercent = (n: number): number =>
  Math.max(0, Math.min(100, Math.round(n)));

export async function GET(req: Request) {
  // 1) Auth check (strict)
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Extract courseId (required)
  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");
  if (!courseId) {
    return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
  }

  try {
    // 3) Load persisted progress meta (only the fields your model has)
    const rec = await prisma.userCourseProgress.findFirst({
      where: { userId: session.user.id, courseId },
      select: {
        completedModuleIds: true,
        lastModuleId: true,
        percent: true,
      },
    });

    // IMPORTANT: Your current course page expects:
    //   { progress: { currentModuleIndex, currentLessonIndex, answers } | null }
    // Since we don't store these per your schema, we return progress: null,
    // and provide a separate `meta` payload which the UI can optionally show.
    return NextResponse.json(
      {
        progress: null, // keep client fallback behavior intact
        meta: rec
          ? {
              completedModuleIds: rec.completedModuleIds ?? [],
              lastModuleId: rec.lastModuleId ?? null,
              percent: typeof rec.percent === "number" ? clampPercent(rec.percent) : null,
            }
          : null,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/courses/progress] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  // 1) Auth check (strict)
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2) Parse body (defensively)
    const body = await req.json().catch(() => ({} as any));

    // Required: courseId
    const rawCourseId = body?.courseId;
    const courseId = typeof rawCourseId === "string" ? rawCourseId : "";
    if (!courseId) {
      return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
    }

    // Optional high-level progress the client *may* send. We accept but only
    // persist fields that exist in your schema:
    // - completedModuleIds?: string[]
    // - lastModuleId?: string
    // - percent?: number
    //
    // NOTE: The client may also send:
    //   currentModuleIndex, currentLessonIndex, answers
    // These are intentionally ignored here to stay schema-compatible.
    const completedModuleIds: string[] = Array.isArray(body?.completedModuleIds)
      ? body.completedModuleIds.filter((s: unknown) => typeof s === "string")
      : [];

    const lastModuleId: string | null =
      typeof body?.lastModuleId === "string" ? body.lastModuleId : null;

    // If the client passes percent we clamp it; if not, we compute it below.
    let percent: number | null =
      typeof body?.percent === "number" ? clampPercent(body.percent) : null;

    // 3) If percent wasn't provided, compute it from how many published modules
    //    were marked completed (cheap, fast). This keeps the DB authoritative.
    if (percent === null) {
      // Count total published modules in this course
      const totalPublished = await prisma.courseModule.count({
        where: { courseId, isPublished: true },
      });

      // Compute percentage based on completedModuleIds (dedup + filter non-empty)
      const uniqueCompleted = Array.from(new Set(completedModuleIds)).filter(Boolean);
      percent =
        totalPublished > 0
          ? clampPercent((uniqueCompleted.length / totalPublished) * 100)
          : 0;
    }

    // 4) Upsert the snapshot (single write, idempotent for this user+course)
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

    // 5) Respond with a minimal OK payload (no sensitive data)
    return NextResponse.json({ ok: true, percent }, { status: 200 });
  } catch (err) {
    console.error("[POST /api/courses/progress] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

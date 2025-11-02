// app/api/course/progress/route.ts
//
// Durable, per-user course progress + exact-lesson resume
// -------------------------------------------------------
// This file defines the canonical handlers for:
//   GET  /api/course/progress?courseId=...
//   POST /api/course/progress
//
// Why this exists:
// - Your client calls `/api/course/progress` (singular).
// - 404s in your logs show this route was missing/uncompiled.
// - We implement it here and keep the logic fully self-contained.
// - A plural alias is provided separately to avoid future mismatches.
//
// Pillars: security, robustness, simplicity, efficiency, ease of management.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Optional: make this route uncacheable by any edge/CDN layer.
export const dynamic = "force-dynamic";

// ---------- Small helpers ----------
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string") as string[];
}
function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}
function clampPercent(n: unknown): number | null {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}
async function computePercentFallback(opts: {
  courseId: string;
  completedCount: number;
}): Promise<number> {
  // Keep it cheap: a single count query.
  const totalModules = await prisma.courseModule.count({
    where: { courseId: opts.courseId },
  });
  if (totalModules <= 0) return 0;
  const pct = Math.round((opts.completedCount / totalModules) * 100);
  return Math.max(0, Math.min(100, pct));
}

// ---------- GET: read progress ----------
export async function GET(req: Request) {
  // 1) Auth: user must be signed in.
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Validate inputs.
  const { searchParams } = new URL(req.url);
  const courseId = (searchParams.get("courseId") || "").trim();
  if (!courseId) {
    return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
  }

  try {
    // 3) Get row (if any).
    const row = await prisma.userCourseProgress.findFirst({
      where: { userId: session.user.id, courseId },
      select: { completedModuleIds: true, lastModuleId: true, lastLessonId: true, percent: true },
    });

    const completedModuleIds = toStringArray(row?.completedModuleIds);
    const lastModuleId = typeof row?.lastModuleId === "string" ? row.lastModuleId : null;
    const lastLessonId = typeof row?.lastLessonId === "string" ? row.lastLessonId : null;

    // 4) Percent: use stored value if valid; otherwise compute a safe fallback.
    let percent: number | null =
      typeof row?.percent === "number" ? clampPercent(row?.percent) : null;

    if (percent === null) {
      percent = await computePercentFallback({
        courseId,
        completedCount: completedModuleIds.length,
      });
    }

    // 5) Return a simple, flattened shape + meta for richer clients.
    return NextResponse.json(
      {
        completedModuleIds,
        percent,
        lastModuleId,
        lastLessonId,
        meta: {
          completedModuleIds,
          lastModuleId,
          lastLessonId,
          percent,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/course/progress] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------- POST: write progress ----------
export async function POST(req: Request) {
  // 1) Auth: user must be signed in.
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Parse + normalize body.
  const body = await req.json().catch(() => ({} as any));
  const courseId = (body?.courseId as string | undefined)?.trim() || "";
  if (!courseId) {
    return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
  }

  const addModuleId = (body?.addModuleId as string | undefined)?.trim() || undefined;
  const overwrite   = toStringArray(body?.completedModuleIds);
  const lastModuleId =
    typeof body?.lastModuleId === "string" ? body.lastModuleId.trim() : undefined;
  const lastLessonId =
    typeof body?.lastLessonId === "string" ? body.lastLessonId.trim() : undefined;

  const incomingPercent = clampPercent(body?.percent);

  const hasAdd          = typeof addModuleId === "string";
  const hasOverwrite    = overwrite.length > 0;
  const hasPositionOnly = !hasAdd && !hasOverwrite && typeof lastLessonId === "string";

  // You must choose exactly one write intent:
  if (![hasAdd, hasOverwrite, hasPositionOnly].filter(Boolean).length) {
    return NextResponse.json(
      {
        error:
          "Provide exactly one of: { addModuleId } OR { completedModuleIds: string[] } OR { lastLessonId }",
      },
      { status: 400 }
    );
  }

  try {
    // 3) Start from existing row (if any).
    const existing = await prisma.userCourseProgress.findFirst({
      where: { userId: session.user.id, courseId },
      select: { completedModuleIds: true, lastModuleId: true, lastLessonId: true, percent: true },
    });

    let nextCompleted = toStringArray(existing?.completedModuleIds);

    // 4) Branch writes.
    if (hasOverwrite) {
      nextCompleted = uniqueStrings(overwrite);
    }
    if (hasAdd) {
      nextCompleted = uniqueStrings(addModuleId ? [...nextCompleted, addModuleId] : nextCompleted);
    }

    // 5) Percent: recompute when completions change; else keep existing.
    const percentToStore =
      hasAdd || hasOverwrite
        ? (incomingPercent !== null
            ? incomingPercent
            : await computePercentFallback({
                courseId,
                completedCount: nextCompleted.length,
              }))
        : (typeof existing?.percent === "number" ? clampPercent(existing?.percent) ?? null : null);

    // 6) Build update shape (only set fields that are relevant).
    const updateData: {
      completedModuleIds?: string[];
      lastModuleId?: string | null;
      lastLessonId?: string | null;
      percent?: number | null;
    } = {};

    if (hasAdd || hasOverwrite) {
      updateData.completedModuleIds = nextCompleted;
      updateData.percent = percentToStore ?? null;
    }
    if (typeof lastModuleId === "string") updateData.lastModuleId = lastModuleId || null;
    if (typeof lastLessonId === "string") updateData.lastLessonId = lastLessonId || null;

    // 7) Upsert (single row per (userId, courseId)).
    const saved = await prisma.userCourseProgress.upsert({
      where: { userId_courseId: { userId: session.user.id, courseId } },
      create: {
        userId: session.user.id,
        courseId,
        completedModuleIds: updateData.completedModuleIds ?? nextCompleted ?? [],
        lastModuleId:
          typeof updateData.lastModuleId !== "undefined"
            ? updateData.lastModuleId
            : existing?.lastModuleId ?? null,
        lastLessonId:
          typeof updateData.lastLessonId !== "undefined"
            ? updateData.lastLessonId
            : existing?.lastLessonId ?? null,
        percent:
          typeof updateData.percent === "number" || updateData.percent === null
            ? (updateData.percent as number | null)
            : percentToStore ?? null,
      },
      update: updateData,
      select: { completedModuleIds: true, lastModuleId: true, lastLessonId: true, percent: true },
    });

    // 8) Return normalized shape (+ meta).
    const out = {
      completedModuleIds: toStringArray(saved.completedModuleIds),
      percent: typeof saved.percent === "number" ? clampPercent(saved.percent) : null,
      lastModuleId: typeof saved.lastModuleId === "string" ? saved.lastModuleId : null,
      lastLessonId: typeof saved.lastLessonId === "string" ? saved.lastLessonId : null,
      meta: {
        completedModuleIds: toStringArray(saved.completedModuleIds),
        percent: typeof saved.percent === "number" ? clampPercent(saved.percent) : null,
        lastModuleId: typeof saved.lastModuleId === "string" ? saved.lastModuleId : null,
        lastLessonId: typeof saved.lastLessonId === "string" ? saved.lastLessonId : null,
      },
    };

    return NextResponse.json(out, { status: 200 });
  } catch (err) {
    console.error("[POST /api/course/progress] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

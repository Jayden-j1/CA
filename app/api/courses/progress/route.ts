// app/api/courses/progress/route.ts
//
// Robust, production-safe progress API.
// --------------------------------------------------------------
// What changed (surgical):
// • Added runtime feature-detection for the DB column `UserCourseProgress.lastLessonId`.
// • If the column is missing in production (migration not yet applied), we gracefully
//   fall back (no crash) and continue to persist completions + lastModuleId.
// • Once the migration is applied, the same code auto-enables exact-lesson resume.
//
// Pillars: efficiency, robustness, simplicity, ease of management, security.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// --------- tiny utils --------------------------------------------------------

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
async function computePercentFallback(opts: { courseId: string; completedCount: number }): Promise<number> {
  const totalModules = await prisma.courseModule.count({ where: { courseId: opts.courseId } });
  if (totalModules <= 0) return 0;
  const pct = Math.round((opts.completedCount / totalModules) * 100);
  return Math.max(0, Math.min(100, pct));
}

/**
 * Detect if an error likely came from a missing column (e.g., `lastLessonId`).
 * Prisma's error codes can vary by engine/driver; we conservatively key off message text too.
 */
function looksLikeMissingColumnError(err: unknown, columnName: string): boolean {
  const msg = String((err as any)?.message ?? "");
  return (
    msg.includes("does not exist") && msg.toLowerCase().includes(columnName.toLowerCase())
  ) || (err as any)?.code === "P2022"; // P2022 is "The column does not exist" in some contexts.
}

// --------- runtime feature switch (cached per lambda instance) ---------------
//
// null   => unknown; try with column, and cache result
// true   => column exists; always use it
// false  => column missing; never select/write it
//
let SUPPORTS_LAST_LESSON: boolean | null = null;

/** Safe select shape based on feature flag. */
function selectShape() {
  return SUPPORTS_LAST_LESSON
    ? { completedModuleIds: true, lastModuleId: true, lastLessonId: true, percent: true }
    : { completedModuleIds: true, lastModuleId: true, /* lastLessonId omitted */ percent: true };
}

/** Read progress row with graceful fallback if the column is missing. */
async function safeFindProgress(userId: string, courseId: string) {
  // First attempt: include lastLessonId if not explicitly disabled
  if (SUPPORTS_LAST_LESSON !== false) {
    try {
      const row = await prisma.userCourseProgress.findFirst({
        where: { userId, courseId },
        select: selectShape(),
      });
      // If we got here, lastLessonId exists (or was omitted). Cache true if we included it.
      if (SUPPORTS_LAST_LESSON === null) SUPPORTS_LAST_LESSON = true;
      return { row, usedLastLesson: SUPPORTS_LAST_LESSON === true };
    } catch (err) {
      // If this is a "lastLessonId column missing" scenario, fall back once and cache false.
      if (looksLikeMissingColumnError(err, "lastLessonId")) {
        SUPPORTS_LAST_LESSON = false;
        const row = await prisma.userCourseProgress.findFirst({
          where: { userId, courseId },
          select: selectShape(),
        });
        return { row, usedLastLesson: false };
      }
      // Any other error: bubble up.
      throw err;
    }
  }

  // Explicitly disabled: no lastLessonId
  const row = await prisma.userCourseProgress.findFirst({
    where: { userId, courseId },
    select: selectShape(),
  });
  return { row, usedLastLesson: false };
}

/** Upsert with graceful fallback if lastLessonId column is missing. */
async function safeUpsertProgress(args: {
  userId: string;
  courseId: string;
  nextCompleted?: string[];
  lastModuleId?: string | null;
  lastLessonId?: string | null; // ignored if column unsupported
  percent?: number | null;
}) {
  const { userId, courseId, nextCompleted, lastModuleId, lastLessonId, percent } = args;

  // Build update/create payloads conditionally.
  const mkData = (includeLastLesson: boolean) => {
    const updateData: {
      completedModuleIds?: string[];
      lastModuleId?: string | null;
      lastLessonId?: string | null;
      percent?: number | null;
    } = {};
    if (nextCompleted) updateData.completedModuleIds = nextCompleted;
    if (typeof percent !== "undefined") updateData.percent = percent ?? null;
    if (typeof lastModuleId !== "undefined") updateData.lastModuleId = lastModuleId ?? null;
    if (includeLastLesson && typeof lastLessonId !== "undefined") {
      updateData.lastLessonId = lastLessonId ?? null;
    }
    return updateData;
  };

  const includeLast = SUPPORTS_LAST_LESSON !== false;
  // Try once with lastLessonId (unless known to be unsupported)
  if (includeLast) {
    try {
      const saved = await prisma.userCourseProgress.upsert({
        where: { userId_courseId: { userId, courseId } },
        create: {
          userId,
          courseId,
          ...mkData(true),
        },
        update: mkData(true),
        select: selectShape(),
      });
      if (SUPPORTS_LAST_LESSON === null) SUPPORTS_LAST_LESSON = true;
      return { saved, usedLastLesson: true };
    } catch (err) {
      if (looksLikeMissingColumnError(err, "lastLessonId")) {
        // Column is missing in production DB. Cache and retry without it.
        SUPPORTS_LAST_LESSON = false;
        const saved = await prisma.userCourseProgress.upsert({
          where: { userId_courseId: { userId, courseId } },
          create: {
            userId,
            courseId,
            ...mkData(false),
          },
          update: mkData(false),
          select: selectShape(),
        });
        return { saved, usedLastLesson: false };
      }
      throw err;
    }
  }

  // Known unsupported: do not write lastLessonId at all.
  const saved = await prisma.userCourseProgress.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: {
      userId,
      courseId,
      ...mkData(false),
    },
    update: mkData(false),
    select: selectShape(),
  });
  return { saved, usedLastLesson: false };
}

// ---------------------------- GET -------------------------------------------

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const courseId = (searchParams.get("courseId") || "").trim();
  if (!courseId) return NextResponse.json({ error: "Missing courseId" }, { status: 400 });

  try {
    const { row } = await safeFindProgress(session.user.id, courseId);

    const completedModuleIds = toStringArray(row?.completedModuleIds);
    const lastModuleId = typeof row?.lastModuleId === "string" ? row?.lastModuleId : null;
    // If column unsupported, row will not have lastLessonId selected → treat as null.
    const lastLessonId = typeof (row as any)?.lastLessonId === "string" ? (row as any)?.lastLessonId : null;

    let percent: number | null = typeof row?.percent === "number" ? clampPercent(row?.percent) : null;
    if (percent === null) {
      percent = await computePercentFallback({ courseId, completedCount: completedModuleIds.length });
    }

    return NextResponse.json(
      {
        completedModuleIds,
        percent,
        lastModuleId,
        lastLessonId,
        meta: { completedModuleIds, lastModuleId, lastLessonId, percent },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/courses/progress] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------- POST ------------------------------------------

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const courseId = (body?.courseId as string | undefined)?.trim() || "";
  if (!courseId) return NextResponse.json({ error: "Missing courseId" }, { status: 400 });

  // Inputs (normalized)
  const addModuleId = (body?.addModuleId as string | undefined)?.trim() || undefined;
  const overwrite = toStringArray(body?.completedModuleIds);
  const lastModuleId = typeof body?.lastModuleId === "string" ? body.lastModuleId.trim() : undefined;
  const lastLessonId = typeof body?.lastLessonId === "string" ? body.lastLessonId.trim() : undefined;
  const incomingPercent = clampPercent(body?.percent);

  const hasAdd = typeof addModuleId === "string";
  const hasOverwrite = overwrite.length > 0;
  const hasPositionOnly = !hasAdd && !hasOverwrite && typeof lastLessonId === "string";
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
    // Read existing (tolerant to missing lastLessonId column)
    const { row } = await safeFindProgress(session.user.id, courseId);
    let nextCompleted = toStringArray(row?.completedModuleIds);

    // Branching exactly as before
    if (hasOverwrite) nextCompleted = uniqueStrings(overwrite);
    if (hasAdd) nextCompleted = uniqueStrings(addModuleId ? [...nextCompleted, addModuleId] : nextCompleted);

    let percentToStore =
      hasAdd || hasOverwrite
        ? incomingPercent !== null
          ? incomingPercent
          : await computePercentFallback({ courseId, completedCount: nextCompleted.length })
        : (typeof row?.percent === "number" ? clampPercent(row?.percent) ?? null : null);

    // IMPORTANT: If DB doesn't support lastLessonId yet, safeUpsertProgress will ignore it.
    const { saved } = await safeUpsertProgress({
      userId: session.user.id,
      courseId,
      nextCompleted: (hasAdd || hasOverwrite) ? nextCompleted : undefined,
      lastModuleId,                         // harmless if only position ping
      lastLessonId,                         // auto-ignored if column missing
      percent: (hasAdd || hasOverwrite) ? percentToStore ?? null : undefined,
    });

    const out = {
      completedModuleIds: toStringArray(saved.completedModuleIds),
      percent: typeof saved.percent === "number" ? clampPercent(saved.percent) : null,
      lastModuleId: typeof saved.lastModuleId === "string" ? saved.lastModuleId : null,
      lastLessonId: typeof (saved as any)?.lastLessonId === "string" ? (saved as any).lastLessonId : null,
      meta: {
        completedModuleIds: toStringArray(saved.completedModuleIds),
        percent: typeof saved.percent === "number" ? clampPercent(saved.percent) : null,
        lastModuleId: typeof saved.lastModuleId === "string" ? saved.lastModuleId : null,
        lastLessonId: typeof (saved as any)?.lastLessonId === "string" ? (saved as any).lastLessonId : null,
      },
    };

    return NextResponse.json(out, { status: 200 });
  } catch (err) {
    console.error("[POST /api/courses/progress] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// app/api/courses/progress/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
function looksLikeMissingColumnError(err: unknown, columnName: string): boolean {
  const e: any = err;
  const msg = String(e?.message ?? "");
  return (
    msg.toLowerCase().includes("does not exist") &&
    msg.toLowerCase().includes(columnName.toLowerCase())
  ) || e?.code === "P2022";
}
function isNotFoundError(err: unknown): boolean {
  return (err as any)?.code === "P2025";
}
function sanitizeErrorForClient(err: unknown) {
  const e: any = err;
  return {
    code: e?.code ?? "UNKNOWN",
    message: typeof e?.message === "string" ? e.message.slice(0, 300) : "Unexpected error",
  };
}

let SUPPORTS_LAST_LESSON: boolean | null = null;
function selectShape() {
  return SUPPORTS_LAST_LESSON
    ? { completedModuleIds: true, lastModuleId: true, lastLessonId: true, percent: true }
    : { completedModuleIds: true, lastModuleId: true, /* lastLessonId */ percent: true };
}
async function safeFindProgress(userId: string, courseId: string) {
  if (SUPPORTS_LAST_LESSON !== false) {
    try {
      const row = await prisma.userCourseProgress.findFirst({
        where: { userId, courseId },
        select: selectShape(),
      });
      if (SUPPORTS_LAST_LESSON === null) SUPPORTS_LAST_LESSON = true;
      return { row, usedLastLesson: true };
    } catch (err) {
      if (looksLikeMissingColumnError(err, "lastLessonId")) {
        SUPPORTS_LAST_LESSON = false;
        const row = await prisma.userCourseProgress.findFirst({
          where: { userId, courseId },
          select: selectShape(),
        });
        return { row, usedLastLesson: false };
      }
      throw err;
    }
  }
  const row = await prisma.userCourseProgress.findFirst({
    where: { userId, courseId },
    select: selectShape(),
  });
  return { row, usedLastLesson: false };
}
function buildWriteData(opts: {
  nextCompleted?: string[];
  lastModuleId?: string | null;
  lastLessonId?: string | null;
  percent?: number | null;
  includeLastLesson: boolean;
}) {
  const { nextCompleted, lastModuleId, lastLessonId, percent, includeLastLesson } = opts;
  const data: any = {};
  if (nextCompleted) data.completedModuleIds = nextCompleted;
  if (typeof percent !== "undefined") data.percent = percent ?? null;
  if (typeof lastModuleId !== "undefined") data.lastModuleId = lastModuleId ?? null;
  if (includeLastLesson && typeof lastLessonId !== "undefined") data.lastLessonId = lastLessonId ?? null;
  return data;
}
async function safeWriteProgress(args: {
  userId: string;
  courseId: string;
  nextCompleted?: string[];
  lastModuleId?: string | null;
  lastLessonId?: string | null;
  percent?: number | null;
}) {
  const { userId, courseId, nextCompleted, lastModuleId, lastLessonId, percent } = args;

  const tryWrite = async (includeLastLesson: boolean) => {
    const updateData = buildWriteData({
      nextCompleted, lastModuleId, lastLessonId, percent, includeLastLesson,
    });
    try {
      const updated = await prisma.userCourseProgress.update({
        where: { userId_courseId: { userId, courseId } },
        data: updateData,
        select: selectShape(),
      });
      return updated;
    } catch (err) {
      if (!isNotFoundError(err)) throw err;
    }
    const createData = buildWriteData({
      nextCompleted: nextCompleted ?? [],
      lastModuleId, lastLessonId, percent, includeLastLesson,
    });
    const created = await prisma.userCourseProgress.create({
      data: { userId, courseId, ...createData },
      select: selectShape(),
    });
    return created;
  };

  if (SUPPORTS_LAST_LESSON !== false) {
    try {
      const saved = await tryWrite(true);
      if (SUPPORTS_LAST_LESSON === null) SUPPORTS_LAST_LESSON = true;
      return { saved, usedLastLesson: true };
    } catch (err) {
      if (looksLikeMissingColumnError(err, "lastLessonId")) {
        SUPPORTS_LAST_LESSON = false;
        const saved = await tryWrite(false);
        return { saved, usedLastLesson: false };
      }
      throw err;
    }
  }
  const saved = await tryWrite(false);
  return { saved, usedLastLesson: false };
}
async function ensureCourseExists(courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  return !!course;
}

// GET
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const courseId = (searchParams.get("courseId") || "").trim();
  if (!courseId) return NextResponse.json({ error: "Missing courseId" }, { status: 400 });

  try {
    const courseExists = await ensureCourseExists(courseId);
    const { row } = await safeFindProgress(session.user.id, courseId);

    const completedModuleIds = toStringArray(row?.completedModuleIds);
    const lastModuleId = typeof row?.lastModuleId === "string" ? row?.lastModuleId : null;
    const lastLessonId = typeof (row as any)?.lastLessonId === "string" ? (row as any).lastLessonId : null;
    let percent: number | null = typeof row?.percent === "number" ? clampPercent(row?.percent) : null;
    if (percent === null) {
      percent = await computePercentFallback({ courseId, completedCount: completedModuleIds.length });
    }

    return NextResponse.json(
      { courseExists, completedModuleIds, percent, lastModuleId, lastLessonId,
        meta: { completedModuleIds, lastModuleId, lastLessonId, percent } },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/courses/progress] error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: sanitizeErrorForClient(err) },
      { status: 500 }
    );
  }
}

// POST
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const courseId = (body?.courseId as string | undefined)?.trim() || "";
  if (!courseId) return NextResponse.json({ error: "Missing courseId" }, { status: 400 });

  const exists = await ensureCourseExists(courseId);
  if (!exists) {
    return NextResponse.json(
      {
        error: "COURSE_NOT_FOUND_FOR_ID",
        message:
          "The provided courseId does not exist in the Course table for this environment. Seed/sync the Course row in the same database used by Vercel (DATABASE_URL).",
        hint: { courseId, next: "Verify DATABASE_URL and ensure Course is present in that DB." },
      },
      { status: 422 }
    );
  }

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
      { error: "Provide exactly one of: { addModuleId } OR { completedModuleIds: string[] } OR { lastLessonId }" },
      { status: 400 }
    );
  }

  try {
    const { row } = await safeFindProgress(session.user.id, courseId);
    let nextCompleted = toStringArray(row?.completedModuleIds);
    if (hasOverwrite) nextCompleted = uniqueStrings(overwrite);
    if (hasAdd) nextCompleted = uniqueStrings(addModuleId ? [...nextCompleted, addModuleId] : nextCompleted);

    let percentToStore =
      hasAdd || hasOverwrite
        ? incomingPercent !== null
          ? incomingPercent
          : await computePercentFallback({ courseId, completedCount: nextCompleted.length })
        : (typeof row?.percent === "number" ? clampPercent(row?.percent) ?? null : null);

    const { saved } = await safeWriteProgress({
      userId: session.user.id,
      courseId,
      nextCompleted: (hasAdd || hasOverwrite) ? nextCompleted : undefined,
      lastModuleId,
      lastLessonId,
      percent: (hasAdd || hasOverwrite) ? (percentToStore ?? null) : undefined,
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
  } catch (err: any) {
    if (err?.code === "P2003") {
      console.error("[POST /api/courses/progress] FK violation:", err?.meta ?? err);
      return NextResponse.json(
        {
          error: "FK_VIOLATION",
          message: "Foreign key constraint failed while saving progress. This usually means the courseId is not in the Course table for this database.",
          details: sanitizeErrorForClient(err),
        },
        { status: 422 }
      );
    }
    console.error("[POST /api/courses/progress] error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: sanitizeErrorForClient(err) },
      { status: 500 }
    );
  }
}

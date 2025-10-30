// app/api/course/progress/route.ts
//
// Purpose
// -------
// Persist per-user, per-course progress (module completion) and *resume position*
// on the server without altering any other flows (auth, signup, staff, payments).
//
// Minimal API surface (stable + extended):
// - GET  /api/course/progress?courseId=...  ->
//     {
//       completedModuleIds: string[],
//       percent?: number | null,
//       lastModuleId?: string | null,
//       lastLessonId?: string | null,              // NEW: exact-lesson resume pointer
//       meta?: { completedModuleIds: string[], lastModuleId: string | null, lastLessonId: string | null, percent: number | null }
//     }
//
// - POST /api/course/progress               ->
//     Accepts exactly *one* of the following write types:
//
//     1) Completion (append one):
//        { courseId: string, addModuleId: string, lastModuleId?: string, lastLessonId?: string, percent?: number }
//
//     2) Completion (overwrite all):
//        { courseId: string, completedModuleIds: string[], lastModuleId?: string, lastLessonId?: string, percent?: number }
//
//     3) Position-only ping (no completion change)  // NEW (allows cross-device resume mid-module)
//        { courseId: string, lastLessonId: string, lastModuleId?: string }
//
// Notes
// -----
// - We prefer a client-sent `percent` when provided (clamped 0..100).
// - If `percent` is absent, we compute a safe fallback from (completed/total)*100.
// - We mirror `percent`, `lastModuleId`, and `lastLessonId` at the top level (and in meta)
//   so simple clients can read without parsing meta.
//
// Pillars
// -------
// - Security: NextAuth session required; users only touch their own row.
// - Simplicity: clear shape and behaviors; no hidden side effects.
// - Robustness: defensive JSON parsing, set semantics, idempotent upsert.
// - Efficiency: one read + one upsert (+ one count if computing fallback).
// - Ease of management: heavily commented and explicit branching.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// --- Small helpers -----------------------------------------------------------

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
  const totalModules = await prisma.courseModule.count({
    where: { courseId: opts.courseId },
  });
  if (totalModules <= 0) return 0;
  const pct = Math.round((opts.completedCount / totalModules) * 100);
  return Math.max(0, Math.min(100, pct));
}

// --- GET ---------------------------------------------------------------------

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const courseId = (searchParams.get("courseId") || "").trim();
  if (!courseId) {
    return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
  }

  try {
    const row = await prisma.userCourseProgress.findFirst({
      where: { userId: session.user.id, courseId },
      // NEW: select lastLessonId for exact resume
      select: { completedModuleIds: true, lastModuleId: true, lastLessonId: true, percent: true },
    });

    const completedModuleIds = toStringArray(row?.completedModuleIds);
    const lastModuleId =
      typeof row?.lastModuleId === "string" ? row?.lastModuleId : null;
    const lastLessonId =
      typeof row?.lastLessonId === "string" ? row?.lastLessonId : null;

    let percent: number | null =
      typeof row?.percent === "number" ? clampPercent(row?.percent) : null;

    if (percent === null) {
      percent = await computePercentFallback({
        courseId,
        completedCount: completedModuleIds.length,
      });
    }

    return NextResponse.json(
      {
        completedModuleIds,
        percent,
        lastModuleId,
        lastLessonId, // NEW
        meta: {
          completedModuleIds,
          lastModuleId,
          lastLessonId, // NEW
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

// --- POST --------------------------------------------------------------------

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const courseId = (body?.courseId as string | undefined)?.trim() || "";
  if (!courseId) {
    return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
  }

  // Inputs (normalized)
  const addModuleId =
    (body?.addModuleId as string | undefined)?.trim() || undefined;
  const overwrite = toStringArray(body?.completedModuleIds);
  const lastModuleId =
    typeof body?.lastModuleId === "string" ? body.lastModuleId.trim() : undefined;
  const lastLessonId =
    typeof body?.lastLessonId === "string" ? body.lastLessonId.trim() : undefined;

  const incomingPercent = clampPercent(body?.percent);

  const hasAdd = typeof addModuleId === "string";
  const hasOverwrite = overwrite.length > 0;
  const hasPositionOnly = !hasAdd && !hasOverwrite && typeof lastLessonId === "string";

  // Enforce *exactly one* write intent:
  //  - add one completion, OR overwrite all completions, OR position-only ping.
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
    const existing = await prisma.userCourseProgress.findFirst({
      where: { userId: session.user.id, courseId },
      select: { completedModuleIds: true, lastModuleId: true, lastLessonId: true, percent: true },
    });

    // Start from existing completion set
    let nextCompleted = toStringArray(existing?.completedModuleIds);

    // Branch 1: Overwrite all completions
    if (hasOverwrite) {
      nextCompleted = uniqueStrings(overwrite);
    }

    // Branch 2: Add a single module to completions
    if (hasAdd) {
      nextCompleted = uniqueStrings(
        addModuleId ? [...nextCompleted, addModuleId] : nextCompleted
      );
    }

    // Compute % to store (only when we changed the completion set);
    // for position-only pings, leave percent as-is.
    let percentToStore =
      hasAdd || hasOverwrite
        ? incomingPercent !== null
          ? incomingPercent
          : await computePercentFallback({
              courseId,
              completedCount: nextCompleted.length,
            })
        : (typeof existing?.percent === "number" ? clampPercent(existing?.percent) ?? null : null);

    // Build update object (we only set fields that are relevant for the branch).
    const updateData: {
      completedModuleIds?: string[];
      lastModuleId?: string | null;
      lastLessonId?: string | null; // NEW
      percent?: number | null;
    } = {};

    if (hasAdd || hasOverwrite) {
      updateData.completedModuleIds = nextCompleted;
      updateData.percent = percentToStore ?? null;
    }

    // We always accept provided lastModuleId / lastLessonId (they do not imply completion).
    if (typeof lastModuleId === "string") {
      updateData.lastModuleId = lastModuleId || null;
    }
    if (typeof lastLessonId === "string") {
      updateData.lastLessonId = lastLessonId || null;
    }

    const saved = await prisma.userCourseProgress.upsert({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId,
        },
      },
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

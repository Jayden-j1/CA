// app/api/course/progress/route.ts
//
// Purpose
// -------
// Persist per-user, per-course progress (module completion) on the server,
// without altering *any* other flows (auth, signup, staff, payments).
//
// Minimal API surface (stable):
// - GET  /api/course/progress?courseId=...  ->
//     {
//       completedModuleIds: string[],
//       // NEW (compat helpers for simpler UIs):
//       percent?: number | null,
//       lastModuleId?: string | null,
//       // Rich payload for clients that want structured data
//       meta?: { completedModuleIds: string[], lastModuleId: string | null, percent: number | null }
//     }
// - POST /api/course/progress               ->
//     {
//       completedModuleIds: string[],
//       // NEW (compat helpers):
//       percent: number,
//       lastModuleId: string | null,
//       meta: { completedModuleIds: string[], lastModuleId: string | null, percent: number }
//     }
//
// Notes
// -----
// - We prefer a client-sent `percent` when provided (clamped 0..100).
// - If `percent` is absent (or null), we compute a safe fallback
//   from (completed modules / total modules) * 100.
// - We now mirror `percent` and `lastModuleId` at the *top level*
//   in addition to `meta` to support simple progress bars without parsing `meta`.
//
// Pillars
// -------
// - Security: requires NextAuth session; users only touch their own row
// - Simplicity: tiny, well-documented surface; no hidden writes
// - Robustness: defensive JSON parsing, set semantics (dedupe), idempotent upsert
// - Efficiency: one read + one upsert (+ one lightweight count if computing fallback)
// - Ease of management: comments explain all branches/decisions

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
      select: { completedModuleIds: true, lastModuleId: true, percent: true },
    });

    const completedModuleIds = toStringArray(row?.completedModuleIds);
    const lastModuleId =
      typeof row?.lastModuleId === "string" ? row?.lastModuleId : null;

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
        meta: {
          completedModuleIds,
          lastModuleId,
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

  const addModuleId =
    (body?.addModuleId as string | undefined)?.trim() || undefined;
  const overwrite = toStringArray(body?.completedModuleIds);
  const lastModuleId =
    typeof body?.lastModuleId === "string" ? body.lastModuleId.trim() : undefined;

  const incomingPercent = clampPercent(body?.percent);

  const hasAdd = typeof addModuleId === "string";
  const hasOverwrite = overwrite.length > 0;
  if ((hasAdd && hasOverwrite) || (!hasAdd && !hasOverwrite)) {
    return NextResponse.json(
      {
        error:
          "Provide exactly one of: { addModuleId } OR { completedModuleIds: string[] }",
      },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.userCourseProgress.findFirst({
      where: { userId: session.user.id, courseId },
      select: { completedModuleIds: true, lastModuleId: true, percent: true },
    });

    let nextCompleted: string[];
    if (hasOverwrite) {
      nextCompleted = uniqueStrings(overwrite);
    } else {
      const current = toStringArray(existing?.completedModuleIds);
      nextCompleted = uniqueStrings(addModuleId ? [...current, addModuleId] : current);
    }

    const percentToStore =
      incomingPercent !== null
        ? incomingPercent
        : await computePercentFallback({
            courseId,
            completedCount: nextCompleted.length,
          });

    const updateData: {
      completedModuleIds: string[];
      lastModuleId?: string | null;
      percent: number;
    } = {
      completedModuleIds: nextCompleted,
      percent: percentToStore,
    };

    if (typeof lastModuleId === "string") {
      updateData.lastModuleId = lastModuleId || null;
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
        completedModuleIds: nextCompleted,
        lastModuleId: updateData.lastModuleId ?? null,
        percent: percentToStore,
      },
      update: updateData,
      select: { completedModuleIds: true, lastModuleId: true, percent: true },
    });

    const out = {
      completedModuleIds: toStringArray(saved.completedModuleIds),
      percent: clampPercent(saved.percent) ?? percentToStore,
      lastModuleId: typeof saved.lastModuleId === "string" ? saved.lastModuleId : null,
      meta: {
        completedModuleIds: toStringArray(saved.completedModuleIds),
        percent: clampPercent(saved.percent) ?? percentToStore,
        lastModuleId: typeof saved.lastModuleId === "string" ? saved.lastModuleId : null,
      },
    };

    return NextResponse.json(out, { status: 200 });
  } catch (err) {
    console.error("[POST /api/course/progress] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


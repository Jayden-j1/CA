// app/api/course/progress/route.ts
//
// Purpose
// -------
// Persist per-user, per-course progress (module completion) on the server,
// without altering *any* other flows (auth, signup, staff, payments).
//
// Minimal API surface (stable):
// - GET  /api/course/progress?courseId=...  -> { completedModuleIds: string[], meta?: { completedModuleIds, lastModuleId, percent } }
// - POST /api/course/progress               -> { completedModuleIds: string[] }
//      Body (exactly one of):
//        • { courseId: string, addModuleId: string, lastModuleId?: string,  percent?: number }
//        • { courseId: string, completedModuleIds: string[], lastModuleId?: string, percent?: number }
//
// What changed (surgical):
// - GET now also returns a meta payload including { completedModuleIds, lastModuleId, percent }
//   while preserving the original top-level { completedModuleIds } for backward compatibility.
// - POST now accepts an optional percent and *prefers* it. If absent, we compute a safe
//   fallback from (completed modules / total modules) * 100.
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

// Normalize unknown JSON to string[]
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string") as string[];
}

// Produce a deduped, compacted string[]
function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

// Clamp a number to an integer in [0, 100]
function clampPercent(n: unknown): number | null {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// Compute a safe fallback percent if client omitted it
async function computePercentFallback(opts: {
  courseId: string;
  completedCount: number;
}): Promise<number> {
  // NOTE: We *do not* rely on any extra flags (e.g., isPublished) to avoid schema coupling.
  // We simply divide by the total modules for the course currently in DB.
  const totalModules = await prisma.courseModule.count({
    where: { courseId: opts.courseId },
  });
  if (totalModules <= 0) return 0;
  const pct = Math.round((opts.completedCount / totalModules) * 100);
  return Math.max(0, Math.min(100, pct));
}

// --- GET /api/course/progress?courseId=... ----------------------------------
//
// Returns the current user's completed module ids for the given course.
// Back-compat: top-level { completedModuleIds }.
// New: meta payload for richer clients (e.g., dashboard ring), including percent.
export async function GET(req: Request) {
  // 1) Require authenticated user
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Validate required query param
  const { searchParams } = new URL(req.url);
  const courseId = (searchParams.get("courseId") || "").trim();
  if (!courseId) {
    return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
  }

  try {
    // 3) Load existing row (if any). We return both a back-compat shape and meta.
    const row = await prisma.userCourseProgress.findFirst({
      where: { userId: session.user.id, courseId },
      select: { completedModuleIds: true, lastModuleId: true, percent: true },
    });

    const completedModuleIds = toStringArray(row?.completedModuleIds);
    const lastModuleId =
      typeof row?.lastModuleId === "string" ? row?.lastModuleId : null;
    const percent =
      typeof row?.percent === "number" ? clampPercent(row?.percent) : null;

    // Back-compat (top-level) + new rich meta
    return NextResponse.json(
      {
        completedModuleIds,
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

// --- POST /api/course/progress ----------------------------------------------
//
// Two supported shapes (send exactly one):
//  A) Add one module id (set semantics, idempotent):
//     { courseId: string, addModuleId: string, lastModuleId?: string, percent?: number }
//
//  B) Overwrite the set completely:
//     { courseId: string, completedModuleIds: string[], lastModuleId?: string, percent?: number }
//
// Behavior (surgical change):
// - If percent is provided, we prefer it (clamped 0..100).
// - If percent is omitted, we compute a fallback from completed/total.
// - We always return the final list: { completedModuleIds: string[] }
export async function POST(req: Request) {
  // 1) Require authenticated user
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Parse and validate body (defensively)
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

  // Optional percent (new)
  const incomingPercent = clampPercent(body?.percent);

  // Enforce exactly one mode (A or B)
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
    // 3) Load current row (if any) to merge with
    const existing = await prisma.userCourseProgress.findFirst({
      where: { userId: session.user.id, courseId },
      select: { completedModuleIds: true, lastModuleId: true, percent: true },
    });

    // 4) Compute the next completed set
    let nextCompleted: string[];
    if (hasOverwrite) {
      // Overwrite mode: trust caller's set (still dedupe/compact)
      nextCompleted = uniqueStrings(overwrite);
    } else {
      // Add-one mode: merge addModuleId into existing set
      const current = toStringArray(existing?.completedModuleIds);
      nextCompleted = uniqueStrings(addModuleId ? [...current, addModuleId] : current);
    }

    // 5) Determine the percent to store:
    //    - Prefer the client-sent value (already clamped)
    //    - Otherwise compute a safe fallback (completed / total)
    const percentToStore =
      incomingPercent !== null
        ? incomingPercent
        : await computePercentFallback({
            courseId,
            completedCount: nextCompleted.length,
          });

    // 6) Build the update fields.
    const updateData: {
      completedModuleIds: string[];
      lastModuleId?: string | null;
      percent: number;
    } = {
      completedModuleIds: nextCompleted,
      percent: percentToStore,
    };

    if (typeof lastModuleId === "string") {
      // Normalize empty → null; otherwise use the provided id
      updateData.lastModuleId = lastModuleId || null;
    }

    // 7) Upsert a single row per (userId, courseId), idempotently
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
      select: { completedModuleIds: true },
    });

    return NextResponse.json(
      { completedModuleIds: toStringArray(saved.completedModuleIds) },
      { status: 200 }
    );
  } catch (err) {
    console.error("[POST /api/course/progress] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}









// // app/api/course/progress/route.ts
// //
// // Purpose
// // -------
// // Persist per-user, per-course progress (module completion) on the server,
// // without altering *any* other flows (auth, signup, staff, payments).
// //
// // Minimal API surface (stable):
// // - GET  /api/course/progress?courseId=...  -> { completedModuleIds: string[], meta?: { completedModuleIds, lastModuleId, percent } }
// // - POST /api/course/progress               -> { completedModuleIds: string[] }
// //      Body (exactly one of):
// //        • { courseId: string, addModuleId: string, lastModuleId?: string,  percent?: number }
// //        • { courseId: string, completedModuleIds: string[], lastModuleId?: string, percent?: number }
// //
// // What changed (surgical):
// // - GET now also returns a `meta` payload including { completedModuleIds, lastModuleId, percent }
// //   while preserving the original top-level { completedModuleIds } for backward compatibility.
// // - POST now accepts an optional `percent` and *prefers* it. If absent, we compute a safe
// //   fallback from (completed modules / total modules) * 100.
// //
// // Pillars
// // -------
// // - Security: requires NextAuth session; users only touch their own row
// // - Simplicity: tiny, well-documented surface; no hidden writes
// // - Robustness: defensive JSON parsing, set semantics (dedupe), idempotent upsert
// // - Efficiency: one read + one upsert (+ one lightweight count if computing fallback)
// // - Ease of management: comments explain all branches/decisions

// import { NextResponse } from "next/server";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";
// import { prisma } from "@/lib/prisma";

// // --- Small helpers -----------------------------------------------------------

// // Normalize unknown JSON to string[]
// function toStringArray(value: unknown): string[] {
//   if (!Array.isArray(value)) return [];
//   return value.filter((v) => typeof v === "string") as string[];
// }

// // Produce a deduped, compacted string[]
// function uniqueStrings(items: string[]): string[] {
//   return Array.from(new Set(items.filter(Boolean)));
// }

// // Clamp a number to an integer in [0, 100]
// function clampPercent(n: unknown): number | null {
//   if (typeof n !== "number" || Number.isNaN(n)) return null;
//   return Math.max(0, Math.min(100, Math.round(n)));
// }

// // Compute a safe fallback percent if client omitted it
// async function computePercentFallback(opts: {
//   courseId: string;
//   completedCount: number;
// }): Promise<number> {
//   // NOTE: We *do not* rely on any extra flags (e.g., isPublished) to avoid schema coupling.
//   // We simply divide by the total modules for the course currently in DB.
//   const totalModules = await prisma.courseModule.count({
//     where: { courseId: opts.courseId },
//   });
//   if (totalModules <= 0) return 0;
//   const pct = Math.round((opts.completedCount / totalModules) * 100);
//   return Math.max(0, Math.min(100, pct));
// }

// // --- GET /api/course/progress?courseId=... ----------------------------------
// //
// // Returns the current user's completed module ids for the given course.
// // Back-compat: top-level { completedModuleIds }.
// // New: `meta` payload for richer clients (e.g., dashboard ring), including percent.
// export async function GET(req: Request) {
//   // 1) Require authenticated user
//   const session = await getServerSession(authOptions);
//   if (!session?.user?.id) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   // 2) Validate required query param
//   const { searchParams } = new URL(req.url);
//   const courseId = (searchParams.get("courseId") || "").trim();
//   if (!courseId) {
//     return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
//   }

//   try {
//     // 3) Load existing row (if any). We return both a back-compat shape and `meta`.
//     const row = await prisma.userCourseProgress.findFirst({
//       where: { userId: session.user.id, courseId },
//       select: { completedModuleIds: true, lastModuleId: true, percent: true },
//     });

//     const completedModuleIds = toStringArray(row?.completedModuleIds);
//     const lastModuleId =
//       typeof row?.lastModuleId === "string" ? row?.lastModuleId : null;
//     const percent =
//       typeof row?.percent === "number" ? clampPercent(row?.percent) : null;

//     // Back-compat (top-level) + new rich meta
//     return NextResponse.json(
//       {
//         completedModuleIds,
//         meta: {
//           completedModuleIds,
//           lastModuleId,
//           percent,
//         },
//       },
//       { status: 200 }
//     );
//   } catch (err) {
//     console.error("[GET /api/course/progress] error:", err);
//     return NextResponse.json({ error: "Internal server error" }, { status: 500 });
//   }
// }

// // --- POST /api/course/progress ----------------------------------------------
// //
// // Two supported shapes (send exactly one):
// //  A) Add one module id (set semantics, idempotent):
// //     { courseId: string, addModuleId: string, lastModuleId?: string, percent?: number }
// //
// //  B) Overwrite the set completely:
// //     { courseId: string, completedModuleIds: string[], lastModuleId?: string, percent?: number }
// //
// // Behavior (surgical change):
// // - If `percent` is provided, we prefer it (clamped 0..100).
// // - If `percent` is omitted, we compute a fallback from completed/total.
// // - We always return the final list: { completedModuleIds: string[] }
// export async function POST(req: Request) {
//   // 1) Require authenticated user
//   const session = await getServerSession(authOptions);
//   if (!session?.user?.id) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   // 2) Parse and validate body (defensively)
//   const body = await req.json().catch(() => ({} as any));
//   const courseId = (body?.courseId as string | undefined)?.trim() || "";
//   if (!courseId) {
//     return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
//   }

//   const addModuleId =
//     (body?.addModuleId as string | undefined)?.trim() || undefined;
//   const overwrite = toStringArray(body?.completedModuleIds);
//   const lastModuleId =
//     typeof body?.lastModuleId === "string" ? body.lastModuleId.trim() : undefined;

//   // Optional percent (new)
//   const incomingPercent = clampPercent(body?.percent);

//   // Enforce exactly one mode (A or B)
//   const hasAdd = typeof addModuleId === "string";
//   const hasOverwrite = overwrite.length > 0;
//   if ((hasAdd && hasOverwrite) || (!hasAdd && !hasOverwrite)) {
//     return NextResponse.json(
//       {
//         error:
//           "Provide exactly one of: { addModuleId } OR { completedModuleIds: string[] }",
//       },
//       { status: 400 }
//     );
//   }

//   try {
//     // 3) Load current row (if any) to merge with
//     const existing = await prisma.userCourseProgress.findFirst({
//       where: { userId: session.user.id, courseId },
//       select: { completedModuleIds: true, lastModuleId: true, percent: true },
//     });

//     // 4) Compute the next completed set
//     let nextCompleted: string[];
//     if (hasOverwrite) {
//       // Overwrite mode: trust caller's set (still dedupe/compact)
//       nextCompleted = uniqueStrings(overwrite);
//     } else {
//       // Add-one mode: merge addModuleId into existing set
//       const current = toStringArray(existing?.completedModuleIds);
//       nextCompleted = uniqueStrings(addModuleId ? [...current, addModuleId] : current);
//     }

//     // 5) Determine the percent to store:
//     //    - Prefer the client-sent value (already clamped)
//     //    - Otherwise compute a safe fallback (completed / total)
//     const percentToStore =
//       incomingPercent !== null
//         ? incomingPercent
//         : await computePercentFallback({
//             courseId,
//             completedCount: nextCompleted.length,
//           });

//     // 6) Build the update fields.
//     const updateData: {
//       completedModuleIds: string[];
//       lastModuleId?: string | null;
//       percent: number;
//     } = {
//       completedModuleIds: nextCompleted,
//       percent: percentToStore,
//     };

//     if (typeof lastModuleId === "string") {
//       // Normalize empty → null; otherwise use the provided id
//       updateData.lastModuleId = lastModuleId || null;
//     }

//     // 7) Upsert a single row per (userId, courseId), idempotently
//     const saved = await prisma.userCourseProgress.upsert({
//       where: {
//         userId_courseId: {
//           userId: session.user.id,
//           courseId,
//         },
//       },
//       create: {
//         userId: session.user.id,
//         courseId,
//         completedModuleIds: nextCompleted,
//         lastModuleId: updateData.lastModuleId ?? null,
//         percent: percentToStore,
//       },
//       update: updateData,
//       select: { completedModuleIds: true },
//     });

//     return NextResponse.json(
//       { completedModuleIds: toStringArray(saved.completedModuleIds) },
//       { status: 200 }
//     );
//   } catch (err) {
//     console.error("[POST /api/course/progress] error:", err);
//     return NextResponse.json({ error: "Internal server error" }, { status: 500 });
//   }
// }










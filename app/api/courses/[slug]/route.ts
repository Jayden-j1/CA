// app/api/courses/[slug]/route.ts
//
// ============================================================
// Course Detail (Sanity → Published Only)
// ------------------------------------------------------------
// Purpose
//   Fetch a single course by slug from Sanity and normalize the shape
//   your UI already expects: flat `modules[]` each with `lessons[]`.
//
// What changed
//   • Prisma removed from this path: content is CMS-owned.
//   • Sanity is the single source of truth (published only).
//   • Proper stable ordering + flattening retained.
//
// Why this design
//   • Instant authoring → production flow (no sync job)
//   • Clean DTO for UI, no client transforms
//   • Production caching (ISR + SWR)
//
// Pillars
//   ✅ Efficiency   – single GROQ; single-pass flatten+order
//   ✅ Robustness   – guards for undefined; sensible fallbacks
//   ✅ Simplicity   – one, consistent DTO for your UI
//   ✅ Security     – published content only
//   ✅ Ease of mgmt – comments + helpers; no duplicated logic
// ============================================================

import { NextResponse } from "next/server";
import { fetchSanity } from "@/lib/sanity/client";
import { COURSE_DETAIL_BY_SLUG } from "@/lib/sanity/queries";

// Revalidate every 60s; also send cache headers in the response.
export const revalidate = 60;

// ------------------------------
// Helpers
// ------------------------------

/** Safe ID generator across runtimes (Edge/Node) */
function safeId(): string {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {}
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Stable sort by optional numeric `order`, preserving source order.
 * - Missing/invalid orders go to the end (treated as +∞).
 */
function sortByOrderAny(arr: any[]): any[] {
  return [...(arr || [])].sort((a, b) => {
    const ao = typeof a?.order === "number" && Number.isFinite(a.order) ? a.order : Number.POSITIVE_INFINITY;
    const bo = typeof b?.order === "number" && Number.isFinite(b.order) ? b.order : Number.POSITIVE_INFINITY;
    return ao - bo;
  });
}

/**
 * Recursively flatten:
 *   Module → (Lessons + Submodules[Module → Lessons])
 * into a single-level modules[] with ordered lessons[] per entry.
 *
 * We also keep a "Parent — Child" title for submodule-derived entries
 * so users see where content came from in the flat list.
 */
function flattenModules(modules: any[]): any[] {
  const result: any[] = [];

  for (const m of sortByOrderAny(modules)) {
    const baseId = m?._id ?? m?.id ?? safeId();
    const baseTitle = m?.title ?? "Untitled Module";
    const baseDesc = m?.description ?? undefined;

    // A) Module lessons
    if (Array.isArray(m?.lessons) && m.lessons.length > 0) {
      const mappedLessons = sortByOrderAny(m.lessons).map((l: any) => ({
        id: l?._id ?? safeId(),
        title: l?.title ?? "Lesson",
        videoUrl: l?.videoUrl ?? "",
        // Keep Portable Text body as-is; the client renderer supports it.
        body: l?.body ?? l?.content ?? undefined,
        quiz: l?.quiz
          ? {
              title: l.quiz.title ?? undefined,
              questions: Array.isArray(l.quiz.questions) ? l.quiz.questions : [],
              passingScore: l.quiz.passingScore ?? undefined,
            }
          : undefined,
      }));

      result.push({
        id: baseId,
        title: baseTitle,
        description: baseDesc,
        lessons: mappedLessons,
      });
    }

    // B) Submodules → their lessons
    if (Array.isArray(m?.submodules) && m.submodules.length > 0) {
      for (const sm of sortByOrderAny(m.submodules)) {
        const subId = sm?._id ?? sm?.id ?? safeId();
        const subTitle = sm?.title ?? "Untitled Submodule";
        const subDesc = sm?.description ?? undefined;

        const subLessons: any[] =
          Array.isArray(sm?.lessons) && sm.lessons.length > 0
            ? sortByOrderAny(sm.lessons).map((sl: any) => ({
                id: sl?._id ?? safeId(),
                title: sl?.title ?? "Lesson",
                videoUrl: sl?.videoUrl ?? "",
                body: sl?.body ?? sl?.content ?? undefined,
                quiz: sl?.quiz
                  ? {
                      title: sl.quiz.title ?? undefined,
                      questions: Array.isArray(sl.quiz.questions) ? sl.quiz.questions : [],
                      passingScore: sl.quiz.passingScore ?? undefined,
                    }
                  : undefined,
              }))
            : [
                // Fallback: treat the submodule as a single-lesson container
                {
                  id: `${subId}-lesson`,
                  title: subTitle,
                  videoUrl: sm?.videoUrl ?? "",
                  body: sm?.content ?? undefined,
                  quiz: undefined,
                },
              ];

        result.push({
          id: subId,
          title: `${baseTitle} — ${subTitle}`,
          description: subDesc,
          lessons: subLessons,
        });
      }
    }

    // C) Neither lessons nor submodules → single-content fallback
    const noLessons = !Array.isArray(m?.lessons) || m.lessons.length === 0;
    const noSubs = !Array.isArray(m?.submodules) || m.submodules.length === 0;

    if (noLessons && noSubs) {
      result.push({
        id: baseId,
        title: baseTitle,
        description: baseDesc,
        lessons: [
          {
            id: `${baseId}-lesson`,
            title: baseTitle,
            videoUrl: m?.videoUrl ?? "",
            body: m?.content ?? undefined,
            quiz: undefined,
          },
        ],
      });
    }
  }

  return result;
}

// ------------------------------------------------------------
// Handler
// ------------------------------------------------------------
// ⚠️ Pages (not routes) in Next 15 sometimes require "promisified" params.
//    Route handlers do NOT — we can use the classic signature here.
export async function GET(
  req: Request,
  ctx: { params: { slug: string } } // simple & supported in route handlers
) {
  const slug = ctx.params?.slug;
  if (!slug) {
    return NextResponse.json({ error: "Missing course slug" }, { status: 400 });
  }

  try {
    // 1) Pull the full hierarchical shape for this course (published only).
    const doc = await fetchSanity<any>(COURSE_DETAIL_BY_SLUG, { slug });

    if (!doc) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // 2) Normalize for the UI — flat modules with ordered lessons
    const normalized = {
      id: doc.id ?? doc._id,
      slug: doc.slug,
      title: doc.title ?? "Untitled Course",
      summary: doc.summary ?? null,
      coverImage: doc.coverImage ?? null,
      modules: flattenModules(doc.modules || []),
    };

    const headers = {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    };

    return NextResponse.json({ course: normalized }, { headers });
  } catch (err) {
    console.error(`[GET /api/courses/${slug}] Error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

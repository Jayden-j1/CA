// app/api/courses/[slug]/route.ts
//
// ============================================================
// Course detail API (Sanity-only, production-ready)
// ------------------------------------------------------------
// • Fetches a single published course by slug from Sanity
// • Uses tag-aware caching with fetchSanity() (pairs with ODR)
// • Flattens nested submodules → simple modules[] for your UI
// • ✅ Uses fixed GROQ from lib/sanity/queries (no "??")
// • ✅ No 'next-sanity' import (resolves your VS Code warning)
// ------------------------------------------------------------
// Pillars
// - Efficiency : one query + single-pass normalization
// - Robustness : resilient flattening; synthetic IDs where needed
// - Simplicity : DTO exactly what the front-end expects
// - Security   : published-only reads
// - Ease of mgmt: rich comments; trivial to extend
// ============================================================

import { NextResponse } from "next/server";
import { fetchSanity } from "@/lib/sanity/client";
import { COURSE_DETAIL_BY_SLUG } from "@/lib/sanity/queries";

// ---------- Helpers: order/safe id ----------
function sortByOrderAny(arr: any[]): any[] {
  return [...(arr || [])].sort((a, b) => {
    const ao =
      typeof a?.order === "number" && Number.isFinite(a.order) ? a.order : Number.POSITIVE_INFINITY;
    const bo =
      typeof b?.order === "number" && Number.isFinite(b.order) ? b.order : Number.POSITIVE_INFINITY;
    return ao - bo;
  });
}

function safeId(): string {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {}
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- Flatten modules → submodules → lessons ----------
function flattenModules(modules: any[]): any[] {
  const result: any[] = [];
  const top = sortByOrderAny(modules);

  for (const m of top) {
    const baseId = m?._id ?? m?.id ?? safeId();
    const baseTitle = m?.title ?? "Untitled Module";
    const baseDesc = m?.description ?? undefined;

    // A) Module’s own lessons
    if (Array.isArray(m?.lessons) && m.lessons.length > 0) {
      const mappedLessons = sortByOrderAny(m.lessons).map((l: any) => ({
        id: l?._id ?? safeId(),
        title: l?.title ?? "Lesson",
        videoUrl: l?.videoUrl ?? "",
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

    // B) Submodules (flattened)
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
                // Single-lesson fallback from submodule content
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

    // C) Fallback when no lessons or submodules
    if (
      (!Array.isArray(m?.lessons) || m.lessons.length === 0) &&
      (!Array.isArray(m?.submodules) || m.submodules.length === 0)
    ) {
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

// ---------- GET /api/courses/[slug] ----------
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> } // Next 15/edge-safe: params often arrive as a Promise
) {
  try {
    const { slug } = await ctx.params;

    // Pair with ODR: revalidate when you publish/patch this course in Sanity
    const tags = ["COURSE_DETAIL", `COURSE_DETAIL:${slug}`];

    const doc = await fetchSanity<any>(
      COURSE_DETAIL_BY_SLUG,
      { slug },
      { tags, revalidate: 3600 } // 1h TTL safety; ODR will usually refresh instantly
    );

    if (!doc) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const dto = {
      id: doc.id ?? doc._id,
      slug: doc.slug,
      title: doc.title,
      summary: doc.summary ?? null,
      coverImage: typeof doc.coverImage === "string" ? doc.coverImage : doc.coverImage ?? null,
      modules: flattenModules(doc.modules || []),
    };

    return NextResponse.json({ course: dto }, { status: 200 });
  } catch (err) {
    // If GROQ is invalid, fetchSanity will include Sanity's parse error here.
    console.error("[GET /api/courses/[slug]] error:", err);
    return NextResponse.json({ error: "Failed to load course" }, { status: 500 });
  }
}

// app/api/courses/[slug]/route.ts
//
// ============================================================
// Course Detail (Sanity → Published Only)
// ------------------------------------------------------------
// Purpose
//   Fetch a single course by slug from Sanity (published only) and
//   return a normalized flat DTO for your dashboard UI.
//
// Pillars
//   ✅ Efficiency   – single GROQ, cached via ISR (60 s)
//   ✅ Robustness   – guarded normalization + error handling
//   ✅ Simplicity   – no Prisma, no draft mixing
//   ✅ Security     – published content only
//   ✅ Ease of mgmt – strong comments, stable typings
// ============================================================

import { NextResponse } from "next/server";
import { fetchSanity } from "@/lib/sanity/client";
import { COURSE_DETAIL_BY_SLUG } from "@/lib/sanity/queries";

// ✅ Revalidate every 60 s for production caching (ISR)
export const revalidate = 60;

// ------------------------------------------------------------
// Utility helpers
// ------------------------------------------------------------
function safeId(): string {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {}
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sortByOrderAny(arr: any[]): any[] {
  return [...(arr || [])].sort((a, b) => {
    const ao = typeof a?.order === "number" ? a.order : Number.POSITIVE_INFINITY;
    const bo = typeof b?.order === "number" ? b.order : Number.POSITIVE_INFINITY;
    return ao - bo;
  });
}

function flattenModules(modules: any[]): any[] {
  const result: any[] = [];

  for (const m of sortByOrderAny(modules)) {
    const baseId = m?._id ?? safeId();
    const baseTitle = m?.title ?? "Untitled Module";
    const baseDesc = m?.description ?? undefined;

    // A) Direct lessons
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

    // B) Submodules
    if (Array.isArray(m?.submodules) && m.submodules.length > 0) {
      for (const sm of sortByOrderAny(m.submodules)) {
        const subId = sm?._id ?? safeId();
        const subTitle = sm?.title ?? "Untitled Submodule";
        const subDesc = sm?.description ?? undefined;

        const subLessons =
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

    // C) Empty module fallback
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
// ✅ Correct Next.js 15 handler signature
// ------------------------------------------------------------
// - The 2nd argument is *optional* and should be destructured
//   directly if present; no manual type narrowing required.
// - Using async/await with explicit params ensures compatibility
//   with both Edge & Node runtimes.
// ------------------------------------------------------------
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> } // 👈 Promise-based context for Next 15
) {
  const { slug } = await params; // unwrap once

  if (!slug) {
    return NextResponse.json({ error: "Missing course slug" }, { status: 400 });
  }

  try {
    // 1️⃣ Fetch published course document from Sanity
    const doc = await fetchSanity<any>(COURSE_DETAIL_BY_SLUG, { slug });

    if (!doc) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // 2️⃣ Normalize structure for dashboard UI
    const normalized = {
      id: doc.id ?? doc._id,
      slug: doc.slug,
      title: doc.title ?? "Untitled Course",
      summary: doc.summary ?? null,
      coverImage: doc.coverImage ?? null,
      modules: flattenModules(doc.modules || []),
    };

    // 3️⃣ Send response with proper cache headers
    const headers = {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    };

    return NextResponse.json({ course: normalized }, { headers });
  } catch (err) {
    console.error(`[GET /api/courses/${slug}] Error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// app/api/courses/[slug]/route.ts
//
// ============================================================
// Course detail API (Sanity-only, production-ready)
// ------------------------------------------------------------
// • Fetches a single published course by slug from Sanity
// • Uses tag-aware caching with your fetchSanity() helper (pairs with ODR)
// • Flattens nested submodules → simple modules[] for your UI
// • ✅ Fixes GROQ 400: query now defined in lib/sanity/queries WITHOUT "??"
// • ✅ Removes dependency on 'next-sanity' to avoid “Cannot find module” error
// ------------------------------------------------------------
// Pillars
// -------
// ✅ Efficiency  – one query + single-pass flatten + HTTP caching
// ✅ Robustness  – defensive checks for undefined/null shapes
// ✅ Simplicity  – DTO mirrors your UI; no Prisma; no extra deps
// ✅ Security    – published-only fetch (per your helper config)
// ✅ Ease of mgmt – tags integrate with /api/revalidate
// ============================================================

import { NextResponse } from "next/server";
import { fetchSanity } from "@/lib/sanity/client"; // your tag-aware helper (already used elsewhere)
import { COURSE_DETAIL_BY_SLUG } from "@/lib/sanity/queries";

// ------------------------------------------------------------
// Helper: stable sort by optional numeric `order`
// ------------------------------------------------------------
// • Undefined orders go to the end (Infinity) so human ordering wins.
// • Keep type as any[] to avoid fighting TS narrowing in content graphs.
function sortByOrderAny(arr: any[]): any[] {
  return [...(arr || [])].sort((a, b) => {
    const ao =
      typeof a?.order === "number" && Number.isFinite(a.order) ? a.order : Number.POSITIVE_INFINITY;
    const bo =
      typeof b?.order === "number" && Number.isFinite(b.order) ? b.order : Number.POSITIVE_INFINITY;
    return ao - bo;
  });
}

// ------------------------------------------------------------
// Helper: synthetic id (when a child lacks one)
// ------------------------------------------------------------
function safeId(): string {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {}
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ------------------------------------------------------------
// Helper: Flatten modules → submodules → lessons → 1-level modules[]
// ------------------------------------------------------------
// Why? Your UI expects a flat `modules[]` each with `lessons[]`.
// Sanity authors may nest submodules. We flatten here so the UI stays simple.
//
// Title strategy for submodules: "Parent Module — Child Submodule".
// If a module/submodule has no lessons, we synthesize a single lesson from
// its own `content`/`videoUrl` to keep the UI consistent.
function flattenModules(modules: any[]): any[] {
  const result: any[] = [];
  const top = sortByOrderAny(modules);

  for (const m of top) {
    const baseId = m?._id ?? m?.id ?? safeId();
    const baseTitle = m?.title ?? "Untitled Module";
    const baseDesc = m?.description ?? undefined;

    // Case A: Module has its own lessons
    if (Array.isArray(m?.lessons) && m.lessons.length > 0) {
      const mappedLessons = sortByOrderAny(m.lessons).map((l: any) => ({
        id: l?._id ?? safeId(),
        title: l?.title ?? "Lesson",
        videoUrl: l?.videoUrl ?? "",
        // Body can be Portable Text (array) or string; the page normalizes it.
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

    // Case B: Flatten submodules (if any)
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
                // Fallback: treat submodule itself as a single-lesson container
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

    // Case C: Neither lessons nor submodules → single-content fallback
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

// ------------------------------------------------------------
// GET /api/courses/[slug]
// ------------------------------------------------------------
// ⚠️ Next.js 15 typed routes on Vercel often type params as a Promise.
// Use `ctx: { params: Promise<{ slug: string }> }` to be safe.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    // 1) Unwrap slug from promised params
    const { slug } = await ctx.params;

    // 2) Build cache tags for ODR
    const tags = ["COURSE_DETAIL", `COURSE_DETAIL:${slug}`];

    // 3) Fetch published course from Sanity using the fixed query string
    //    Revalidate hourly as a fallback; ODR will usually refresh immediately.
    const doc = await fetchSanity<any>(
      COURSE_DETAIL_BY_SLUG,
      { slug },
      { tags, revalidate: 3600 }
    );

    // 4) 404 if not found / unpublished
    if (!doc) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // 5) Normalize into your front-end DTO
    const dto = {
      id: doc.id ?? doc._id,
      slug: doc.slug,
      title: doc.title,
      summary: doc.summary ?? null,
      coverImage: typeof doc.coverImage === "string" ? doc.coverImage : doc.coverImage ?? null,
      modules: flattenModules(doc.modules || []),
    };

    // 6) Respond (Next caches based on the fetch above)
    return NextResponse.json({ course: dto }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/courses/[slug]] error:", err);
    return NextResponse.json({ error: "Failed to load course" }, { status: 500 });
  }
}

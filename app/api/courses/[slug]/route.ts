// app/api/courses/[slug]/route.ts
//
// ============================================================
// Course detail API (Sanity-only, production-ready)
// ------------------------------------------------------------
// • Fetches a single course by slug from Sanity (published content only)
// • Uses Next.js tag-aware caching (pairs with On-Demand Revalidation)
// • Flattens nested submodules → a simple modules[] list for the UI
// • Next.js 15 typed routes compatible (params as Promise)
// ------------------------------------------------------------
// Pillars
// -------
// ✅ Efficiency  – one Sanity query + single-pass flatten + HTTP caching
// ✅ Robustness  – defensive checks for undefined/null shapes
// ✅ Simplicity  – DTO mirrors your UI; no Prisma, no dual sources
// ✅ Security    – no drafts in production; only published content
// ✅ Ease of mgmt – tags integrate with /api/revalidate endpoint
// ============================================================

import { NextResponse } from "next/server";
import { fetchSanity } from "@/lib/sanity/client"; // ← your tag-aware helper (supports { tags, revalidate } )
import { COURSE_DETAIL_BY_SLUG } from "@/lib/sanity/queries";

// ------------------------------------------------------------
// NOTE ON CACHING
// ------------------------------------------------------------
// We do NOT set `export const dynamic = "force-dynamic"` — that would disable
// Next.js caching entirely. We *want* cache + ODR, so we let Next cache
// using tags below (COURSE_DETAIL + COURSE_DETAIL:<slug>).
//
// The corresponding webhook calls /api/revalidate with these tags, so the
// cache is blasted exactly when you publish a course in Sanity.
// ------------------------------------------------------------

// ------------------------------------------------------------
// Helper: safe ID (works in all runtimes)
// ------------------------------------------------------------
function safeId(): string {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {}
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ------------------------------------------------------------
// Helper: stable sort by optional numeric `order`
// ------------------------------------------------------------
// • Undefined orders go to the end (Infinity) so human ordering wins.
// • We accept any[] to avoid TS narrowing away expected fields.
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
// Helper: Flatten modules → submodules → lessons → 1-level modules[]
// ------------------------------------------------------------
// Why? Your UI expects a flat `modules[]` each with `lessons[]`.
// Sanity authors can nest submodules for organization. We flatten here so
// the front-end remains blissfully simple.
//
// Title strategy for submodules: "Parent Module — Child Submodule"
// This preserves context while staying flat.
//
// We also keep "single-content module" fallback: if a module/submodule has no
// lessons, we synthesize one lesson from its own `content`/`videoUrl`.
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
        // Body can be Portable Text (array) *or* string. Your page normalizes it.
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
// ⚠️ Next.js 15 typed routes: props.params is a Promise. We accept it and await.
// We return a single { course } object in the exact DTO your UI expects.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> } // ← important for Vercel/Next's ParamCheck
) {
  // 1) Unwrap slug from promised params
  const { slug } = await ctx.params;

  // 2) Build cache tags: one generic & one specific
  //    These pair with your /api/revalidate endpoint and Sanity webhook
  const tags = ["COURSE_DETAIL", `COURSE_DETAIL:${slug}`];

  // 3) Fetch published course from Sanity using a static GROQ + params
  //    Revalidate every 1 hour as a safety net; ODR will keep it fresh instantly on publish.
  const doc = await fetchSanity<any>(
    COURSE_DETAIL_BY_SLUG,
    { slug },
    {
      tags,
      revalidate: 3600, // 1 hour TTL (ODR will usually refresh sooner)
      // perspective: 'published'  // (your helper defaults to published; keep it explicit if you added that option)
    }
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
    coverImage:
      // If you later switch to direct asset urls in GROQ, this still stays safe
      doc.coverImage?.asset?._ref ? doc.coverImage : doc.coverImage ?? null,
    modules: flattenModules(doc.modules || []),
  };

  // 6) Respond with JSON (cache handled by Next based on the fetch above)
  return NextResponse.json({ course: dto });
}

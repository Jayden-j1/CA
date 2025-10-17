// app/api/courses/[slug]/route.ts
//
// ============================================================
// Purpose
// --------
// Fetch and normalize a single course by its slug.
// - Preview (draftMode + ?preview=true): from Sanity (includes drafts)
// - Otherwise: from Prisma (published data only)
//
// What’s fixed here
// -----------------
// • Next 15 ParamCheck error -> explicit RouteContext typing for the handler.
// • Retains your flattening (Module -> Submodule -> Lessons) + ordering.
// • Keeps Prisma fallback and identical DTO to the front-end.
//
// Pillars
// -------
// ✅ Efficiency  – minimal transformations; single pass flatten.
// ✅ Robustness  – Sanity→Prisma fallback; guards around optional fields.
// ✅ Simplicity  – one consistent DTO shape for the UI.
// ✅ Security    – draft content gated by Next.js draftMode.
// ✅ Ease of mgmt – small helpers, thorough comments.
//
// ============================================================

import { NextResponse } from "next/server";
import { draftMode } from "next/headers";
import { prisma } from "@/lib/prisma";
import { fetchSanity } from "@/lib/sanity/client";

export const dynamic = "force-dynamic"; // live responses (no static cache)

// ----------------------------------------------
// Next.js 15: make handler params explicitly typed
// ----------------------------------------------
interface RouteContext {
  params: { slug: string };
}

// ----------------------------------------------
// Helper: generate a safe id (Node/Edge/browser)
// ----------------------------------------------
function safeId(): string {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {}
  return `id_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

// ----------------------------------------------
// Helper: stable sort by optional numeric `order`
// ----------------------------------------------
// - If `order` is not a finite number, push to the end.
// - Keeps array order stable (copy + sort).
function sortByOrderAny(arr: any[]): any[] {
  return [...(arr || [])].sort((a, b) => {
    const ao =
      typeof a?.order === "number" && Number.isFinite(a.order)
        ? a.order
        : Number.POSITIVE_INFINITY;
    const bo =
      typeof b?.order === "number" && Number.isFinite(b.order)
        ? b.order
        : Number.POSITIVE_INFINITY;
    return ao - bo;
  });
}

// ---------------------------------------------------------------------
// Helper: recursively flatten modules → submodules → lessons to 1 level
// ---------------------------------------------------------------------
// • Keeps your front-end UI unchanged (flat `modules[]` each with `lessons[]`).
// • Preserves human-friendly context in titles for submodules:
//    "Parent Module — Child Submodule"
// • Accepts loose `any` to avoid TS narrowing away known fields.
function flattenModules(modules: any[]): any[] {
  const result: any[] = [];
  const top = sortByOrderAny(modules);

  for (const m of top) {
    const baseId = m?._id ?? m?.id ?? safeId();
    const baseTitle = m?.title ?? "Untitled Module";
    const baseDesc = m?.description ?? undefined;

    // ---- Case A: Module has its own lessons
    if (Array.isArray(m?.lessons) && m.lessons.length > 0) {
      const mappedLessons = sortByOrderAny(m.lessons).map((l: any) => ({
        id: l?._id ?? safeId(),
        title: l?.title ?? "Lesson",
        videoUrl: l?.videoUrl ?? "",
        // `body` can be Portable Text (array) or string; page will normalize to PT blocks.
        body: l?.body ?? l?.content ?? undefined,
        quiz: l?.quiz
          ? {
              title: l.quiz.title ?? undefined,
              questions: Array.isArray(l.quiz.questions)
                ? l.quiz.questions
                : [],
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

    // ---- Case B: Flatten submodules
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
                      questions: Array.isArray(sl.quiz.questions)
                        ? sl.quiz.questions
                        : [],
                      passingScore: sl.quiz.passingScore ?? undefined,
                    }
                  : undefined,
              }))
            : [
                // Fallback: treat submodule as a single-lesson container
                {
                  id: `${subId}-lesson`,
                  title: subTitle,
                  videoUrl: sm?.videoUrl ?? "",
                  body: sm?.content ?? undefined,
                  quiz: undefined,
                },
              ];

        // Keep hierarchical name for context in the flat list
        result.push({
          id: subId,
          title: `${baseTitle} — ${subTitle}`,
          description: subDesc,
          lessons: subLessons,
        });
      }
    }

    // ---- Case C: Neither lessons nor submodules → single-content fallback
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
// Route Handler: GET /api/courses/[slug]
// ------------------------------------------------------------
export async function GET(req: Request, context: RouteContext) {
  const { slug } = context.params; // ✅ typed from RouteContext
  const { searchParams } = new URL(req.url);
  const previewFlag = searchParams.get("preview") === "true";
  const { isEnabled: draftEnabled } = await draftMode(); // Next 15: async

  try {
    // 1) Preview path → Sanity (drafts visible)
    if (previewFlag && draftEnabled) {
      try {
        const query = /* groq */ `
          *[_type == "course" && slug.current == $slug][0]{
            _id,
            "slug": slug.current,
            title,
            summary,
            "coverImage": select(defined(coverImage.asset->url) => coverImage.asset->url, null),

            // Nested data: modules → lessons + submodules → lessons
            modules[]->{
              _id, title, description, order, videoUrl, content,
              lessons[]->{
                _id, title, order, videoUrl, body,
                quiz->{ title, questions, passingScore }
              },
              submodules[]->{
                _id, title, description, order, videoUrl, content,
                lessons[]->{
                  _id, title, order, videoUrl, body,
                  quiz->{ title, questions, passingScore }
                }
              }
            }
          }
        `;

        const doc = await fetchSanity<any>(
          query,
          { slug },
          { perspective: "previewDrafts" }
        );

        if (doc) {
          return NextResponse.json({
            course: {
              id: doc._id,
              slug: doc.slug,
              title: doc.title,
              summary: doc.summary ?? null,
              coverImage: doc.coverImage ?? null,
              // ✅ flatten nested modules for a stable, simple DTO
              modules: flattenModules(doc.modules || []),
            },
          });
        }
      } catch (err) {
        console.warn(
          `[/api/courses/${slug}] Sanity preview failed; falling back to Prisma:`,
          err
        );
      }
    }

    // 2) Default path → Prisma (published only)
    const course = await prisma.course.findFirst({
      where: { slug, isPublished: true },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        coverImage: true,
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Prisma model is flat (no nested submodules) – keep mapping minimal.
    const modules = await prisma.courseModule.findMany({
      where: { courseId: course.id, isPublished: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        videoUrl: true,
        content: true,
        quiz: {
          select: {
            id: true,
            title: true,
            questions: true,
            passingScore: true,
          },
        },
      },
    });

    const mappedModules = modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description ?? undefined,
      lessons: [
        {
          id: `${m.id}-lesson`,
          title: m.title,
          videoUrl: m.videoUrl ?? "",
          // Prisma: lesson-like content stored as a string in `content`
          body: typeof m.content === "string" ? m.content : undefined,
          quiz:
            Array.isArray(m.quiz?.questions) && m.quiz.questions.length > 0
              ? { questions: m.quiz.questions }
              : undefined,
        },
      ],
    }));

    return NextResponse.json({
      course: { ...course, modules: mappedModules },
    });
  } catch (err) {
    console.error("[GET /api/courses/[slug]] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

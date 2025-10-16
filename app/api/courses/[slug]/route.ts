// app/api/courses/[slug]/route.ts
//
// ============================================================
// Purpose
// --------
// Fetch and normalize a single course by its slug.
// - Preview (draftMode + ?preview=true): from Sanity (includes drafts)
// - Otherwise: from Prisma (published data only)
//
// Design Pillars
// ---------------
// ✅ Efficiency  – Minimal shape transformations; single pass flatten.
// ✅ Robustness  – Automatic fallback from Sanity to Prisma.
// ✅ Simplicity  – One consistent DTO shape for the frontend.
// ✅ Security    – Draft data gated by Next.js draftMode.
// ✅ Ease of management – Clean helpers + clear comments.
//
// ============================================================

import { NextResponse } from "next/server";
import { draftMode } from "next/headers";
import { prisma } from "@/lib/prisma";
import { fetchSanity } from "@/lib/sanity/client";

export const dynamic = "force-dynamic"; // live (no static cache)

// ------------------------------------------------------------
// Helper: Safe ID (works in all runtimes)
// ------------------------------------------------------------
// • Uses Web Crypto randomUUID when available (Next.js Edge/Node supports it).
// • Falls back to time + random if crypto is missing (very rare).
function safeId() {
  try {
    // @ts-ignore - Web Crypto exists in Next runtimes
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {}
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ------------------------------------------------------------
// Helper: stable sort by optional numeric `order`, preserving array order
// ------------------------------------------------------------
// • We accept/return any[] on purpose to avoid TypeScript narrowing the items
//   to only `{ order?: number }` and stripping other properties.
// • Sorting key: place undefined orders at the end (`Infinity`), otherwise ASC.
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

// ------------------------------------------------------------
// Helper: Recursively flatten modules/submodules/lessons
// ------------------------------------------------------------
// • Sanity structure: Module → (Lessons + Submodules[Module → Lessons])
// • We flatten to a 1-level modules[] array so your UI stays unchanged.
// • We preserve order (array order first, numeric `order` as a hint).
function flattenModules(modules: any[]): any[] {
  const result: any[] = [];

  // Top-level modules in stable order
  const top = sortByOrderAny(modules);

  for (const m of top) {
    const baseId = m?._id ?? m?.id ?? safeId();
    const baseTitle = m?.title ?? "Untitled Module";
    const baseDesc = m?.description ?? undefined;

    // Gather current module's lessons (ordered)
    if (Array.isArray(m?.lessons) && m.lessons.length > 0) {
      const mappedLessons = sortByOrderAny(m.lessons).map((l: any) => ({
        id: l?._id ?? safeId(),
        title: l?.title ?? "Lesson",
        videoUrl: l?.videoUrl ?? "",
        // `body` can be Portable Text (array) or string; your page normalizes it to PT
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

    // Flatten submodules (ordered)
    if (Array.isArray(m?.submodules) && m.submodules.length > 0) {
      for (const sm of sortByOrderAny(m.submodules)) {
        const subId = sm?._id ?? sm?.id ?? safeId();
        const subTitle = sm?.title ?? "Untitled Submodule";
        const subDesc = sm?.description ?? undefined;

        const subLessons: any[] = Array.isArray(sm?.lessons) && sm.lessons.length > 0
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

        // Push a flattened module entry with hierarchical title for context
        result.push({
          id: subId,
          title: `${baseTitle} — ${subTitle}`,
          description: subDesc,
          lessons: subLessons,
        });
      }
    }

    // If neither lessons nor submodules exist → single-content module fallback
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
export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const previewFlag = searchParams.get("preview") === "true";

    // Next 15: draftMode() is async
    const { isEnabled: draftEnabled } = await draftMode();
    const slug = params.slug;

    // 1) Preview (Sanity — drafts visible)
    if (previewFlag && draftEnabled) {
      try {
        // Pull fully nested shape (modules + submodules + lessons)
        const query = /* groq */ `
          *[_type == "course" && slug.current == $slug][0]{
            _id,
            "slug": slug.current,
            title,
            summary,
            "coverImage": select(defined(coverImage.asset->url) => coverImage.asset->url, null),

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
              // ✅ flattened + ordered
              modules: flattenModules(doc.modules || []),
            },
          });
        }
      } catch (e) {
        console.warn(
          `[/api/courses/${slug}] Sanity preview failed; using Prisma fallback:`,
          e
        );
      }
    }

    // 2) Default (Prisma — published only)
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

    // Your Prisma model has only modules (no nested submodules). Keep it simple.
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
          select: { id: true, title: true, questions: true, passingScore: true },
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
          // Prisma stores lesson-like content in `content` (string). Page will normalize to PT.
          body: typeof m.content === "string" ? m.content : undefined,
          quiz:
            Array.isArray(m.quiz?.questions) && m.quiz.questions.length
              ? { questions: m.quiz.questions }
              : undefined,
        },
      ],
    }));

    return NextResponse.json({
      course: {
        ...course,
        modules: mappedModules,
      },
    });
  } catch (err) {
    console.error("[GET /api/courses/[slug]] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

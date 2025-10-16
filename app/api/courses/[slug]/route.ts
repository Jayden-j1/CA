// app/api/courses/[slug]/route.ts
//
// ============================================================
// Purpose
// --------
// Fetch and normalize a single course by its slug.
// - Preview (draftMode + ?preview=true): from Sanity (includes drafts)
// - Otherwise: from Prisma (published data only)
//
// Key changes in this version
// ---------------------------
// • FIX: Removed Prisma selection of `submodules` (not in your schema).
// • Sanity path still supports nested submodules and flattens them.
// • Body normalization to Portable Text blocks (PT) so images/rich content
//   pass through from Sanity, and plain strings (from Prisma) are coerced
//   to a valid PT paragraph for consistent rendering.
// • Module-level video/content are wrapped as a single "lesson" if needed.
//
// Design Pillars
// ---------------
// ✅ Efficiency  – Small queries + minimal, localized transformations
// ✅ Robustness  – Sanity errors auto-fallback to Prisma
// ✅ Simplicity  – One consistent DTO shape for your front-end
// ✅ Security    – Drafts only with draftMode + preview flag
// ✅ Ease of management – Clear helpers + comments
//
// ============================================================

import { NextResponse } from "next/server";
import { draftMode } from "next/headers";
import { prisma } from "@/lib/prisma";
import { fetchSanity } from "@/lib/sanity/client";

export const dynamic = "force-dynamic"; // keep this endpoint live/fresh

// ------------------------------------------------------------
// Helper: Make a stable ID when none is provided (rare)
// ------------------------------------------------------------
function safeId(fallbackHint: string) {
  // crypto.randomUUID is available in modern runtimes.
  // If not, fall back to a quick pseudo-unique id.
  try {
    return crypto.randomUUID();
  } catch {
    return `gen_${fallbackHint}_${Math.random().toString(36).slice(2)}`;
  }
}

// ------------------------------------------------------------
// Helper: Normalize "body" into Portable Text blocks (PT)
// ------------------------------------------------------------
// Why? So <PortableTextRenderer /> can always render the content.
// - If Sanity gives us PT blocks, return as-is.
// - If Prisma gives us a plain string (markdown/plaintext), coerce to a
//   single PT paragraph block to keep the UI consistent.
function toPortableTextBlocks(body: unknown): any[] | undefined {
  if (!body) return undefined;

  // Sanity portable text is already an array of typed blocks
  if (Array.isArray(body)) return body;

  // Prisma "content" might be a plain string → coerce to one PT paragraph
  if (typeof body === "string") {
    return [
      {
        _type: "block",
        style: "normal",
        markDefs: [],
        children: [{ _type: "span", text: body }],
      },
    ];
  }

  // Unknown shapes are ignored (defensive)
  return undefined;
}

// ------------------------------------------------------------
// Helper: Recursively FLATTEN Sanity modules/submodules/lessons
// ------------------------------------------------------------
//
// Sanity can store nested submodules. Your front-end expects a flat list of
// modules each with a lessons[] array. We flatten everything so your UI
// doesn’t have to change.
//
function flattenSanityModules(modules: any[]): any[] {
  const result: any[] = [];

  for (const m of modules ?? []) {
    const base = {
      id: m._id ?? m.id ?? safeId("module"),
      title: m.title ?? "Untitled Module",
      description: m.description ?? undefined,
    };

    // Case 1: Direct lessons on this module
    if (Array.isArray(m.lessons) && m.lessons.length > 0) {
      const mappedLessons = m.lessons.map((l: any) => ({
        id: l._id ?? safeId("lesson"),
        title: l.title ?? "Lesson",
        videoUrl: l.videoUrl ?? "",
        // IMPORTANT: keep Portable Text blocks as-is so images and rich content
        // render in your <PortableTextRenderer />. If a plain string sneaks in,
        // coerce to PT blocks for safety.
        body: toPortableTextBlocks(l.body ?? l.content),
        quiz: l.quiz
          ? {
              title: l.quiz.title ?? undefined,
              questions: Array.isArray(l.quiz.questions)
                ? l.quiz.questions
                : [],
              passingScore: l.quiz.passingScore ?? undefined,
            }
          : undefined,
      }));

      result.push({ ...base, lessons: mappedLessons });
    }

    // Case 2: Nested submodules → recursively flatten
    if (Array.isArray(m.submodules) && m.submodules.length > 0) {
      const flattenedSubs = flattenSanityModules(m.submodules).map((sm) => ({
        ...sm,
        // Hierarchical context in the title helps authors and learners
        title: `${base.title} — ${sm.title}`,
      }));
      result.push(...flattenedSubs);
    }

    // Case 3: No lessons/submodules → treat module content as single lesson
    if (
      (!Array.isArray(m.lessons) || m.lessons.length === 0) &&
      (!Array.isArray(m.submodules) || m.submodules.length === 0)
    ) {
      result.push({
        ...base,
        lessons: [
          {
            id: `${base.id}-lesson`,
            title: base.title,
            videoUrl: m.videoUrl ?? "",
            body: toPortableTextBlocks(m.content),
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

    // In Next 15+, draftMode() is async – you must await it
    const { isEnabled: draftEnabled } = await draftMode();
    const slug = params.slug;

    // --------------------------------------------------------
    // 1) PREVIEW path — Sanity (includes drafts)
    // --------------------------------------------------------
    // We dereference modules, optional submodules, and lessons,
    // and then flatten everything into your front-end shape.
    if (previewFlag && draftEnabled) {
      try {
        const query = /* groq */ `
          *[_type == "course" && slug.current == $slug][0]{
            _id,
            "slug": slug.current,
            title,
            summary,
            // If you store image objects, you can project URL or keep object.
            // Here we keep the URL if available to keep it simple.
            "coverImage": select(defined(coverImage.asset->url) => coverImage.asset->url, null),

            // Nested structure: modules → submodules → lessons
            modules[]->{
              _id,
              title,
              description,
              videoUrl,
              content,
              // Lessons can contain Portable Text (including image blocks)
              lessons[]->{
                _id,
                title,
                videoUrl,
                body,
                quiz->{ title, questions, passingScore }
              },
              // Optional nested submodules
              submodules[]->{
                _id,
                title,
                description,
                videoUrl,
                content,
                lessons[]->{
                  _id,
                  title,
                  videoUrl,
                  body,
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
          const courseDto = {
            id: doc._id,
            slug: doc.slug,
            title: doc.title,
            summary: doc.summary ?? null,
            coverImage: doc.coverImage ?? null,
            modules:
              Array.isArray(doc.modules) && doc.modules.length > 0
                ? flattenSanityModules(doc.modules)
                : [],
          };

          return NextResponse.json({ course: courseDto });
        }
      } catch (e) {
        // If Sanity preview fails for any reason, fall back to Prisma below
        console.warn(
          `[/api/courses/${slug}] Sanity preview fetch failed; using Prisma fallback:`,
          e
        );
      }
    }

    // --------------------------------------------------------
    // 2) DEFAULT path — Prisma (published only)
    // --------------------------------------------------------
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

    // NOTE:
    // Your Prisma schema does NOT contain a `submodules` relation on CourseModule.
    // So we only query top-level modules and normalize each as a single-lesson module,
    // using the module's videoUrl/content. If later you add nested tables, you can
    // extend this section similarly to Sanity’s flattening.
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
        // ❌ DO NOT SELECT `submodules`: it's not in your Prisma model.
      },
    });

    // Map Prisma modules into the same DTO shape. Each module becomes a
    // single-lesson module (unless you later extend your relational model).
    const mappedModules = modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description ?? undefined,
      lessons: [
        {
          id: `${m.id}-lesson`,
          title: m.title,
          videoUrl: m.videoUrl ?? "",
          // Normalize Prisma plain string to PT paragraph for consistent rendering
          body: toPortableTextBlocks(
            typeof m.content === "string" ? m.content : undefined
          ),
          quiz:
            Array.isArray(m.quiz?.questions) && m.quiz.questions.length
              ? { questions: m.quiz.questions }
              : undefined,
        },
      ],
    }));

    const dto = { ...course, modules: mappedModules };
    return NextResponse.json({ course: dto });
  } catch (err) {
    console.error("[GET /api/courses/[slug]] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

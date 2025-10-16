// app/api/courses/[slug]/route.ts
//
// Purpose
// -------
// Fetch a single course by its slug.
// - Preview (draftMode + ?preview=true): Sanity (includes drafts).
// - Otherwise: Prisma (published only).
//
// Design Pillars
// --------------
// ✅ Robustness  – Sanity errors auto-fallback to Prisma.
// ✅ Simplicity  – Single source of truth for DTO shape.
// ✅ Security    – Drafts only visible in secure preview mode.
// ✅ Ease of management – Clear structure and strong typing.
//

import { NextResponse } from "next/server";
import { draftMode } from "next/headers";
import { prisma } from "@/lib/prisma";
import { fetchSanity } from "@/lib/sanity/client";

export const dynamic = "force-dynamic"; // prevent static caching

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const previewFlag = searchParams.get("preview") === "true";

    // 🧠 FIXED:
    // Must await draftMode() before destructuring
    const { isEnabled: draftEnabled } = await draftMode();

    const slug = params.slug;

    // ------------------------------------------
    // Helper: map Sanity document → normalized DTO
    // ------------------------------------------
    const mapSanityCourseToDto = (doc: any) => {
      const modules = Array.isArray(doc.modules)
        ? doc.modules.map((m: any) => {
            const lessons = Array.isArray(m.lessons)
              ? m.lessons.map((l: any) => ({
                  id: l._id ?? `${m._id}-lesson`,
                  title: l.title ?? m.title ?? "Lesson",
                  videoUrl: l.videoUrl ?? "",
                  body: l.body ?? undefined, // PortableText or text body
                  quiz: l.quiz
                    ? {
                        questions: Array.isArray(l.quiz.questions)
                          ? l.quiz.questions
                          : [],
                      }
                    : undefined,
                }))
              : [
                  {
                    id: `${m._id}-lesson`,
                    title: m.title ?? "Lesson",
                    videoUrl: m.videoUrl ?? "",
                    body: m.content ?? undefined,
                    quiz: undefined,
                  },
                ];

            return {
              id: m._id,
              title: m.title,
              description: m.description ?? undefined,
              lessons,
            };
          })
        : [];

      return {
        id: doc._id,
        slug: doc.slug,
        title: doc.title,
        summary: doc.summary ?? null,
        coverImage: doc.coverImage ?? null,
        modules,
      };
    };

    // 1️⃣ Preview Mode → Sanity (includes drafts)
    if (previewFlag && draftEnabled) {
      try {
        const query = /* groq */ `
          *[_type == "course" && slug.current == $slug][0]{
            _id,
            "slug": slug.current,
            title,
            summary,
            "coverImage": select(defined(coverImage.asset->url) => coverImage.asset->url, null),
            modules[]->{
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
        `;

        const doc = await fetchSanity<any>(
          query,
          { slug },
          { perspective: "previewDrafts" }
        );

        if (doc) {
          return NextResponse.json({ course: mapSanityCourseToDto(doc) });
        }
      } catch (e) {
        console.warn(`[/api/courses/${slug}] Sanity preview fetch failed; using Prisma fallback:`, e);
      }
    }

    // 2️⃣ Default Path → Prisma (published only)
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

    // Normalize Prisma result into same DTO structure
    const mappedModules = modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description ?? undefined,
      lessons: [
        {
          id: `${m.id}-lesson`,
          title: m.title,
          videoUrl: m.videoUrl ?? "",
          body: typeof m.content === "string" ? m.content : undefined,
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

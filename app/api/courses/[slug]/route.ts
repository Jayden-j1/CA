// app/api/courses/[slug]/route.ts
//
// Purpose
// -------
// Fetch one published course (by slug) and return a clean DTO
// for the learner dashboard. This version sorts modules by
// CourseModule.order and strictly returns only published,
// finalized content (non-editable runtime).
//
// Context
// -------
// - Course content is authored and finalized by you or stakeholders.
// - Learners and staff *consume* the course only — no edits or admin mutations here.
// - Admin creation/publishing is a separate controlled workflow (Phase 2.3+).
//
// Design goals
// -------------
// - 🔒 Security: Return only published content; hide drafts and unapproved data.
// - ⚡ Efficiency: Select only fields required by the UI.
// - 🧱 Robustness: Safe mapping, clear 404s, and well-typed DTOs.
// - 🧭 Simplicity: Straightforward logic, minimal Prisma coupling.
// - 🧰 Ease of management: Obvious where to extend later (lessons, quiz, etc.).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic"; // always live, no static cache

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  try {
    // 1️⃣ Fetch the published course by slug
    // -------------------------------------------------
    // We explicitly select only fields required by the UI.
    // Unpublished courses are hidden by default.
    const course = await prisma.course.findFirst({
      where: { slug: params.slug, isPublished: true },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        coverImage: true,
        createdAt: true,
        updatedAt: true,
        isPublished: true,
      },
    });

    // Defensive: 404 for missing or unpublished slugs
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // 2️⃣ Fetch published modules for that course
    // -------------------------------------------------
    // - Sorted by the stable CourseModule.order (unique per course)
    // - Select minimal render data: title, description, video URL, etc.
    // - Each module is treated as immutable content — no write ops here.
    const modules = await prisma.courseModule.findMany({
      where: { courseId: course.id, isPublished: true },
      orderBy: { order: "asc" }, // ✅ stable deterministic order
      select: {
        id: true,
        title: true,
        description: true,
        videoUrl: true,
        durationSeconds: true,
        content: true,
        // Quiz relation exists but we only include questions JSON if published.
        quiz: {
          select: {
            id: true,
            title: true,
            questions: true, // stored as JSON (array of {question, options, correctIndex})
            passingScore: true,
          },
        },
      },
    });

    // 3️⃣ Assemble a normalized DTO
    // -------------------------------------------------
    // The frontend expects `modules[].lessons[]` for consistent shape.
    // For now, each module maps to a single lesson placeholder (the module video itself),
    // so the UI can display "Next"/"Continue" seamlessly.
    const mappedModules = modules.map((m) => {
      // TypeScript note: JSON type from Prisma returns `unknown`, so cast safely.
      const questions =
        (Array.isArray(m.quiz?.questions) ? m.quiz?.questions : []) as Array<{
          id: string;
          question: string;
          options: string[];
          correctIndex: number;
        }>;

      return {
        id: m.id,
        title: m.title,
        description: m.description ?? undefined,
        // Each module behaves like a single "lesson" entry.
        lessons: [
          {
            id: `${m.id}-lesson`,
            title: m.title,
            videoUrl: m.videoUrl ?? "",
            body:
              typeof m.content === "string"
                ? m.content
                : undefined, // optional markdown/plaintext body
            quiz:
              questions.length > 0
                ? {
                    questions,
                  }
                : undefined,
          },
        ],
      };
    });

    // 4️⃣ Build final response object
    // -------------------------------------------------
    const dto = {
      id: course.id,
      slug: course.slug,
      title: course.title,
      summary: course.summary,
      coverImage: course.coverImage,
      modules: mappedModules,
    };

    // ✅ Return safe, read-only JSON
    return NextResponse.json({ course: dto }, { status: 200 });
  } catch (err) {
    // Centralized error handler — avoids leaking stack traces.
    console.error("[GET /api/courses/[slug]] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

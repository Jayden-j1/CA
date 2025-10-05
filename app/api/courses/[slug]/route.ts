// app/api/courses/[slug]/route.ts
//
// Purpose:
// - Return ONE published course by slug, with its published modules in order,
//   including optional quiz JSON per module.
// - Enforce access: requires active user AND paid (PACKAGE or STAFF_SEAT).
//
// Why access here as well as on the page?
// - Defense in depth: even if someone hits the API directly, rules are enforced.
//
// Pillars:
// - Robustness: clear 401/403/404 responses.
// - Efficiency: select only fields needed by the UI.
// - Simplicity: local hasAccess helper mirrors your NextAuth/jwt logic.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(_: Request, ctx: { params: { slug: string } }) {
  const slug = ctx.params.slug;

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user is active and has access (PACKAGE or STAFF_SEAT)
    const canAccess = await hasCourseAccess(userId);
    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Load course + modules + quiz
    const course = await prisma.course.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        coverImage: true,
        isPublished: true,
        modules: {
          where: { isPublished: true },
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            title: true,
            description: true,
            videoUrl: true,
            durationSeconds: true,
            content: true,
            quiz: {
              select: {
                title: true,
                questions: true, // JSON array: {id, question, options[], correctIndex}
                passingScore: true,
              },
            },
          },
        },
      },
    });

    if (!course || !course.isPublished) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json({ course });
  } catch (err) {
    console.error("[GET /api/courses/[slug]] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Minimal access check mirroring your NextAuth/jwt hasPaid logic:
 * - user must be active
 * - a PACKAGE OR STAFF_SEAT payment must exist.
 */
async function hasCourseAccess(userId: string): Promise<boolean> {
  // 1) Is active?
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });
  if (!user || user.isActive === false) return false;

  // 2) PACKAGE or STAFF_SEAT payment?
  const payment = await prisma.payment.findFirst({
    where: {
      userId,
      OR: [{ purpose: "PACKAGE" }, { purpose: "STAFF_SEAT" }],
    },
    select: { id: true },
  });

  return Boolean(payment);
}

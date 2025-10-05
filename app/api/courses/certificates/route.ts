// app/api/courses/certificate/route.ts
//
// Purpose:
// - Generate and return a PDF certificate *only* if the user has completed the course.
// - Uses the lib/certificate generator; returns as downloadable attachment.
//
// Pillars:
// - Security: requires session; verifies 100% completion.
// - Robustness: clear, typed runtime checks and 4xx/5xx responses.
// - Simplicity: in-memory PDF generation, no persistent storage.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCertificatePDF } from "@/lib/certificate";

export const dynamic = "force-dynamic"; // ensure up-to-date progress checks

export async function GET(_req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1) Find any course progress for this user that’s 100% complete
    //    (If you later support multiple courses, pass ?courseId=... and filter here.)
    const progress = await prisma.userCourseProgress.findFirst({
      where: { userId: session.user.id, percent: 100 },
      select: { percent: true, courseId: true },
    });

    if (!progress || (progress.percent ?? 0) < 100) {
      return NextResponse.json(
        { error: "Course not fully completed" },
        { status: 403 }
      );
    }

    // 2) Resolve course title for the certificate
    const course = await prisma.course.findUnique({
      where: { id: progress.courseId },
      select: { title: true },
    });

    // 3) Generate the certificate in-memory
    const pdfBuffer = await generateCertificatePDF({
      userName: session.user.name ?? "Learner",
      courseTitle: course?.title ?? "Cultural Awareness Course",
      completionDate: new Date().toLocaleDateString(),
    });

    // 4) Return as a proper PDF attachment
    //    Use the native Response with the Buffer as a Uint8Array for type safety.
    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="certificate.pdf"',
        // Optional: prevent caching if desired
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[GET /api/courses/certificate] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

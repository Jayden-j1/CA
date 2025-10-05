// app/api/courses/certificate/route.ts
//
// ============================================================
// Phase History
// ------------------------------------------------------------
// • Phase 2.3 : Initial certificate generation route
// • Phase 3.x : Hardened auth, progress check
// • Phase 4.0 : Final TS-safe Response body (no union types)
// ============================================================
//
// Purpose
// -------
// Generates a downloadable certificate PDF after user completes
// 100% of their course. Converts Buffer → ArrayBuffer cleanly.
//
// Fix Summary
// ------------
// - Explicitly converts Node Buffer → Uint8Array → ArrayBuffer.
// - This avoids the SharedArrayBuffer union that TS flags.
// - Runtime identical, but 100% TypeScript-safe.
//
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCertificatePDF } from "@/lib/certificate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1) Validate user session
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const userName = session?.user?.name || session?.user?.email || "Learner";

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Find latest published course
    const course = await prisma.course.findFirst({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    });

    if (!course) {
      return NextResponse.json(
        { error: "No published course found" },
        { status: 404 }
      );
    }

    // 3) Confirm user has completed 100% of the course
    const moduleCount = await prisma.courseModule.count({
      where: { courseId: course.id, isPublished: true },
    });

    const progress = await prisma.userCourseProgress.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
      select: { percent: true, completedModuleIds: true },
    });

    const hasPercent = (progress?.percent ?? 0) >= 100;
    const hasFullList =
      moduleCount > 0 &&
      (progress?.completedModuleIds?.length ?? 0) >= moduleCount;

    const isComplete = hasPercent || hasFullList;

    if (!isComplete) {
      return NextResponse.json(
        { error: "Certificate available only after 100% completion." },
        { status: 403 }
      );
    }

    // 4) Generate PDF in memory
    const completionDate = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const pdfBuffer = await generateCertificatePDF({
      userName,
      courseTitle: course.title,
      completionDate,
    });

    // ✅ FIX: Convert Buffer → Uint8Array → ArrayBuffer
    // This forces a clean ArrayBuffer type with no SharedArrayBuffer union.
    const uint8 = new Uint8Array(pdfBuffer);
    const arrayBuffer: ArrayBuffer = uint8.buffer.slice(
      uint8.byteOffset,
      uint8.byteOffset + uint8.byteLength
    );

    // 5) Return response with correct headers
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="certificate.pdf"',
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("[GET /api/courses/certificate] Error:", err);
    return NextResponse.json(
      { error: "Unable to generate certificate" },
      { status: 500 }
    );
  }
}

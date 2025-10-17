// app/api/courses/route.ts
//
// ============================================================
// Purpose
// -------
// List courses for the UI to pick a slug to load.
// - Preview (draftMode + ?preview=true): from Sanity (includes drafts)
// - Otherwise: from Prisma (published only)
//
// Shape returned:
//   { courses: Array<{ id: string; slug: string; title: string }> }
//
// Pillars
// -------
// ✅ Efficiency  – minimal fields only
// ✅ Robustness  – preview vs published paths
// ✅ Simplicity  – small handler; one query per path
// ✅ Security    – no wildcard data exposure
// ============================================================

import { NextResponse } from "next/server";
import { draftMode } from "next/headers";
import { prisma } from "@/lib/prisma";
import { fetchSanity } from "@/lib/sanity/client";
import { COURSE_LIST_QUERY } from "@/lib/sanity/queries";

export const dynamic = "force-dynamic"; // always live

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const previewFlag = searchParams.get("preview") === "true";
    const { isEnabled: draftEnabled } = await draftMode();

    // 1) Preview path → Sanity (drafts included)
    if (previewFlag && draftEnabled) {
      try {
        const docs = await fetchSanity<any[]>(COURSE_LIST_QUERY, {});
        // GROQ already returns {id, slug, title}
        return NextResponse.json({ courses: docs ?? [] });
      } catch (e) {
        console.warn("[/api/courses] Sanity list failed, falling back to Prisma:", e);
      }
    }

    // 2) Default path → Prisma (published only)
    const rows = await prisma.course.findMany({
      where: { isPublished: true },
      orderBy: { title: "asc" },
      select: { id: true, slug: true, title: true },
    });

    return NextResponse.json({ courses: rows });
  } catch (err) {
    console.error("[GET /api/courses] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

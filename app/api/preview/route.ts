// app/api/preview/route.ts
//
// Purpose
// -------
// Enable Next.js Draft Mode after validating a secret token, then redirect to a given slug.
// This lets editors preview unpublished Sanity content in your Next.js app.
//
// Why this change?
// ----------------
// In Next 15, `draftMode()` is async and returns a Promise<DraftMode>.
// We must `await draftMode()` before calling `.enable()`.
//
// Security best practices
// -----------------------
// - Require a strong secret token via `SANITY_PREVIEW_SECRET` in your .env
// - Only enable draft mode if the token matches and a slug is provided

import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  const slug = searchParams.get("slug");

  // 1) Validate query & secret
  if (!slug || secret !== process.env.SANITY_PREVIEW_SECRET) {
    return NextResponse.json({ error: "Invalid token or slug" }, { status: 401 });
  }

  // 2) Enable Draft Mode (Next 15: draftMode() is async)
  const dm = await draftMode();
  dm.enable();

  // 3) Redirect to the page you want to preview (e.g., your course route)
  return NextResponse.redirect(new URL(`/dashboard/course/${slug}`, req.url));
}

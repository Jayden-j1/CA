// app/api/preview/enable/route.ts
//
// Purpose:
// - Turn on Next.js draftMode() cookie so preview requests can read Sanity drafts.

import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const { enable } = await draftMode();
  enable();
  // Keep response simple so it works from the browser
  return NextResponse.json({ ok: true, preview: true });
}

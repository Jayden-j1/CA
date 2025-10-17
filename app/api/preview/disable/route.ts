// app/api/preview/disable/route.ts
//
// Purpose:
// - Turn off the draftMode() cookie (exit preview).

import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const { disable } = await draftMode();
  disable();
  return NextResponse.json({ ok: true, preview: false });
}

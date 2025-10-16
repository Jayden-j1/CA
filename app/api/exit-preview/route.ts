// app/api/exit-preview/route.ts
//
// Purpose
// -------
// Securely disable Next.js draftMode (preview mode) and redirect
// the user back to the dashboard or a safe route.
//
// Notes
// -----
// - Complements /api/preview
// - Follows Next 15+ async draftMode() API
// - Clears preview cookies safely

import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const dm = await draftMode();
  dm.disable();

  // Redirect user back to a default route
  return NextResponse.redirect(new URL("/dashboard/course", req.url));
}

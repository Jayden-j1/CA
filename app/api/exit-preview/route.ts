// app/api/exit-preview/route.ts
//
// Purpose
// -------
// Disable Next.js Draft Mode and redirect back to a safe page.
// Pairs with /api/preview so editors can enter/exit preview cleanly.
//
// Security & UX
// -------------
// • No secret required to *exit* preview.
// • Redirect to a provided URL (if safe) or back to /dashboard/course.
// • Only allows same-origin redirects to avoid open-redirect issues.

import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

function isSafeSameOriginRedirect(url: URL, target: string) {
  try {
    const candidate = new URL(target, url);
    return candidate.origin === url.origin; // disallow off-site redirects
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const redirectTo = searchParams.get("redirect");

  // Next 15: draftMode() is async → await first, then call disable()
  const dm = await draftMode();
  dm.disable();

  // Safe fallback target
  let target = "/dashboard/course";

  // If a redirect param is provided and safe, use it
  if (typeof redirectTo === "string" && redirectTo.length > 0) {
    if (isSafeSameOriginRedirect(new URL(req.url), redirectTo)) {
      target = redirectTo;
    }
  }

  return NextResponse.redirect(new URL(target, origin));
}

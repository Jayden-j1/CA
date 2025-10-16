// app/api/sanity/ping/route.ts
//
// Purpose:
// - Smoke test that your Sanity client + env are wired correctly.
// - Returns projectId, dataset, apiVersion, and "ok" if a trivial query runs.
// - Safe: does not expose secrets or token.
//
// Usage:
// - Start dev server and call /api/sanity/ping in the browser or curl.
// - If it returns ok:true, your Phase 1 setup works.

import { NextResponse } from "next/server";
import { fetchSanity } from "@/lib/sanity/client";

export async function GET() {
  try {
    // Tiny query that returns a literal true if the dataset is reachable.
    const ok = await fetchSanity<boolean>("true");

    return NextResponse.json({
      ok: Boolean(ok),
      projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || null,
      dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || null,
      apiVersion: process.env.SANITY_API_VERSION || "2024-03-01",
    });
  } catch (err) {
    console.error("[/api/sanity/ping] Failed:", err);
    return NextResponse.json(
      { ok: false, error: "Sanity fetch failed. Check env and network." },
      { status: 500 }
    );
  }
}

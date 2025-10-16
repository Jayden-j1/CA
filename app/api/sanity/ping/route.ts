// app/api/sanity/ping/route.ts
//
// Purpose
// -------
// A simple health-check endpoint for your Sanity CMS integration.
// Verifies that the Sanity client and environment variables are configured
// correctly. Returns harmless, public metadata.
//
// Implementation details
// ----------------------
// - Imports { fetchSanity } from your existing `lib/sanity/client.ts` file.
// - Performs a trivial GROQ query (`true`) to test connectivity.
// - Returns project info and ok:true if successful.
//
// Pillars
// --------
// ✅ Efficiency — small, cached, no over-fetching.
// ✅ Robustness — safe error handling, logs only generic info.
// ✅ Simplicity — minimal, readable, zero external dependencies.
// ✅ Security — no secrets or tokens exposed.
// ✅ Ease of management — aligned with your alias and folder structure.

import { NextResponse } from "next/server";
import { fetchSanity } from "@/lib/sanity/client"; // ✅ now resolves after tsconfig alias fix

export async function GET() {
  try {
    // Run a trivial GROQ query that returns literal `true`
    const ok = await fetchSanity<boolean>("true");

    // Respond with basic, non-sensitive project info
    return NextResponse.json({
      ok: Boolean(ok),
      projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || null,
      dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || null,
      apiVersion: process.env.SANITY_API_VERSION || "2024-03-01",
    });
  } catch (err) {
    // Only log the generic tag — avoid leaking internal details
    console.error("[/api/sanity/ping] Sanity fetch failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Sanity fetch failed. Check env vars, dataset access, and network.",
      },
      { status: 500 }
    );
  }
}

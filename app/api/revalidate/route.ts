// app/api/revalidate/route.ts
//
// ============================================================
// Sanity → Next.js On-Demand Revalidation (ODR)
// ------------------------------------------------------------
// Purpose
//   Receive signed webhook calls from Sanity on publish/update/
//   delete and selectively purge Next.js caches so your UI and
//   /api/courses endpoints reflect changes immediately.
//
// What it does
//   1) Verifies Sanity HMAC signature (X-Sanity-Signature) with
//      your secret: process.env.SANITY_WEBHOOK_SECRET
//   2) Figures out which course slug(s) need revalidation
//      - If a course doc changed → that course slug
//      - If a module/lesson changed → find parent course(s) by GROQ
//   3) Revalidates both API paths and (optionally) cache tags
//      - /api/courses
//      - /api/courses/[slug]
//
// Pillars
//   ✅ Security   – HMAC check (timing-safe compare)
//   ✅ Robustness – Handles course/module/lesson updates
//   ✅ Simplicity – Clear, small helpers; zero app changes needed
//   ✅ Efficiency – Only revalidate what changed
//   ✅ Ease mgmt  – Lots of comments; copy-paste and go
// ============================================================

import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import crypto from "node:crypto";
import { fetchSanity } from "@/lib/sanity/client";

// ---------- CONFIG ----------
// Set this in your environment (Vercel Project Settings → Environment Variables)
// For local dev, add to .env or .env.local
const WEBHOOK_SECRET = process.env.SANITY_WEBHOOK_SECRET || "";

// Helpers: timing-safe string compare
function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

// Helpers: verify Sanity HMAC signature
function verifySanitySignature(rawBody: string, signatureFromHeader: string | null, secret: string) {
  if (!secret) return false; // no secret configured → reject
  if (!signatureFromHeader) return false;

  // Sanity defaults to hex SHA256 HMAC
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(rawBody).digest("hex");
  return safeEqual(digest, signatureFromHeader);
}

// Helpers: tiny guards
const toArray = <T,>(v: T | T[] | null | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);

// GROQ helpers to discover parent course(s) when a module or lesson changes
const PARENTS_BY_CHILD_ID = /* groq */ `
  *[_type == "course" && references($id)]{
    "slug": slug.current
  }
`;

// The main handler
export async function POST(req: Request) {
  try {
    // 1) Read raw body (required for HMAC validation)
    const rawBody = await req.text();

    // 2) Signature verification
    const signature = req.headers.get("X-Sanity-Signature");
    const isValid = verifySanitySignature(rawBody, signature, WEBHOOK_SECRET);

    if (!isValid) {
      // You can optionally allow a secret query param in DEV ONLY, but
      // we keep this strict for security.
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 3) Parse the webhook body
    // Sanity webhook payloads are configurable; we handle the common shape:
    // - body._type: the document type, e.g., "course", "courseModule", "lesson"
    // - body.slug?.current (for course docs)
    // - body._id: the changed doc id
    const body = JSON.parse(rawBody) as any;

    const docType: string = body?._type ?? "";
    const changedId: string = body?._id ?? "";
    const maybeSlug: string | undefined = body?.slug?.current ?? undefined;

    if (!docType || !changedId) {
      return NextResponse.json({ error: "Missing _type or _id" }, { status: 400 });
    }

    // 4) Decide which slugs to revalidate
    const slugs: string[] = [];

    if (docType === "course") {
      // direct course change → use its slug
      if (maybeSlug) slugs.push(maybeSlug);
    } else if (docType === "courseModule" || docType === "lesson") {
      // module/lesson → find parent course(s)
      const parents = await fetchSanity<{ slug: string }[]>(
        PARENTS_BY_CHILD_ID,
        { id: changedId }
      );
      for (const p of parents || []) {
        if (p?.slug) slugs.push(p.slug);
      }
    } else {
      // Unknown doc type? We can still try to find parents by reference.
      const parents = await fetchSanity<{ slug: string }[]>(
        PARENTS_BY_CHILD_ID,
        { id: changedId }
      );
      for (const p of parents || []) {
        if (p?.slug) slugs.push(p.slug);
      }
    }

    // Always revalidate the course list API because ordering or connections may have changed
    // (This is safe and inexpensive.)
    revalidatePath("/api/courses");
    // Optional tag revalidation (only effective if you add tags in your data fetches)
    try {
      revalidateTag("courses:list");
    } catch {
      /* ignore if tags unused */
    }

    // 5) Revalidate specific course detail endpoints
    const uniqueSlugs = Array.from(new Set(slugs));
    for (const slug of uniqueSlugs) {
      revalidatePath(`/api/courses/${slug}`);

      // If you later tag your fetches (see notes below), we can also do:
      try {
        revalidateTag(`course:${slug}`);
      } catch {
        /* ignore if tags unused */
      }
    }

    return NextResponse.json({
      ok: true,
      revalidated: {
        apiPaths: [
          "/api/courses",
          ...uniqueSlugs.map((s) => `/api/courses/${s}`),
        ],
        tags: ["courses:list", ...uniqueSlugs.map((s) => `course:${s}`)],
      },
    });
  } catch (err) {
    console.error("[/api/revalidate] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Optional (not required) GET for a quick manual check while developing.
// You can call: /api/revalidate?slug=my-course&secret=YOUR_DEV_SECRET
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret") || "";
  const slug = searchParams.get("slug") || "";

  // Dev convenience: allow manual calls if you pass the same secret.
  if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  if (slug) {
    revalidatePath(`/api/courses/${slug}`);
    try {
      revalidateTag(`course:${slug}`);
    } catch {}
  }
  revalidatePath("/api/courses");
  try {
    revalidateTag("courses:list");
  } catch {}

  return NextResponse.json({
    ok: true,
    devManual: true,
    slug: slug || null,
  });
}

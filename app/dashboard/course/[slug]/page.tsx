// app/dashboard/course/[slug]/page.tsx
//
// Purpose
// -------
// Server-side redirector from /dashboard/course/[slug]
// → /dashboard/course?slug=<slug>
//
// Why this approach?
// ------------------
// Next.js 15’s generated types for dynamic pages often wrap `params`/`searchParams`
// in Promises. Accepting those Promises here and redirecting server-side keeps your
// actual course UI centralized in app/dashboard/course/page.tsx (the non-dynamic route).
//
// Pillars
// -------
// ✅ Simplicity: one canonical course page renders the UI
// ✅ Robustness: preserves any other query flags (e.g. preview)
// ✅ Efficiency: zero client JS here; server redirect
// ✅ Ease of management: no duplicated course components
//
import { redirect } from "next/navigation";

// Helper: convert a typed record to URLSearchParams safely
function toURLSearchParams(
  obj: Record<string, string | string[] | undefined> | undefined
) {
  const qs = new URLSearchParams();
  if (!obj) return qs;
  for (const [key, val] of Object.entries(obj)) {
    if (Array.isArray(val)) for (const v of val) qs.append(key, v);
    else if (typeof val === "string") qs.set(key, val);
  }
  return qs;
}

// ⚠️ Next.js 15 typed routes often expect *promisified* props.
// We accept Promises and await them immediately to satisfy the contract.
export default async function Page(props: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // 1) Unwrap provided promises
  const { slug } = await props.params;
  const rawSearch = props.searchParams ? await props.searchParams : undefined;

  // 2) Preserve all query keys & inject/override the slug
  const qs = toURLSearchParams(rawSearch);
  qs.set("slug", slug);

  // 3) Redirect to the canonical page that actually renders the course UI
  redirect(`/dashboard/course?${qs.toString()}`);
}

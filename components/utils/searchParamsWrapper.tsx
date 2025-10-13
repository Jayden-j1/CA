// components/utils/SearchParamsWrapper.tsx
//
// Purpose:
// - Wraps children in <Suspense> so components using useSearchParams()
//   can safely suspend during hydration and avoid CSR bailout errors.
//
// Why this matters:
// - Next.js App Router enforces Suspense boundaries around any hook
//   that reads URLSearchParams.
// - By using this wrapper, pages can import and nest it without repeating Suspense setup.
//

"use client";

import { Suspense } from "react";

export default function SearchParamsWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // ✅ Minimal fallback ensures zero layout shift
  return <Suspense fallback={null}>{children}</Suspense>;
}

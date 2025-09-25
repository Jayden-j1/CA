// components/utils/SearchParamsWrapper.tsx
//
// Purpose:
// - Wraps children in a <Suspense> boundary so hooks like useSearchParams()
//   can run safely without breaking builds.

"use client";

import { Suspense } from "react";

export default function SearchParamsWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

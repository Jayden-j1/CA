// hooks/useRequireAuth.ts
//
// Purpose:
// - Client-side hook for components/pages.
// - Ensures user is authenticated, otherwise redirects.
// - Complements middleware (extra safety inside React).
//
// Everyday: Like a second ID check inside the club.

"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useRequireAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  return { session, status };
}

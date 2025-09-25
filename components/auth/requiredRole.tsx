// components/auth/RequireRole.tsx
//
// Purpose:
// - Wraps children and only renders them if the logged-in user has one
//   of the allowed roles.
// - Redirects to /dashboard if user lacks permission.
// - Complements global middleware (defense-in-depth).
//
// Analogy: Like a VIP wristband — you might be inside the festival (logged in),
// but this ensures you can only access certain rides if you have the wristband.

"use client";

import { ReactNode, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface RequireRoleProps {
  allowed: string[]; // roles that can access
  children: ReactNode;
}

export default function RequireRole({ allowed, children }: RequireRoleProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // 🚫 If user is authenticated but role not allowed → redirect
    if (status === "authenticated") {
      const userRole = session?.user?.role ?? ""; // normalize role
      if (!allowed.includes(userRole)) {
        router.push("/dashboard");
      }
    }
  }, [status, session, allowed, router]);

  if (status === "loading") {
    return <p>Loading...</p>;
  }

  if (!session?.user) {
    // Middleware will already redirect unauthenticated users,
    // so we just return nothing here.
    return null;
  }

  const userRole = session.user.role ?? ""; // normalize again
  if (!allowed.includes(userRole)) {
    return null; // blocked (redirect already triggered)
  }

  return <>{children}</>;
}

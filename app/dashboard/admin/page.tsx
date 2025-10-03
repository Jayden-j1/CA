// app/dashboard/admin/page.tsx
//
// Why this change?
// Although this file itself doesn’t call `useSearchParams`, something in its
// subtree (now or later) likely does in production builds. Wrapping the page
// in <Suspense> guarantees compliance and prevents CSR bailout errors.
//
// Behavior unchanged: same redirects and UI.

"use client";

import { Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import FullPageSpinner from "@/components/ui/fullPageSpinner";

// ---------- Page wrapper that provides the Suspense boundary ----------
export default function AdminPage() {
  return (
    <Suspense fallback={<FullPageSpinner message="Loading Admin Panel..." />}>
      <AdminPageInner />
    </Suspense>
  );
}

// ---------- Original logic lives here unchanged ----------
function AdminPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return <FullPageSpinner message="Loading Admin Panel..." />;
  }

  if (!session?.user) {
    return null;
  }

  const role = session.user.role;

  if (role !== "ADMIN") {
    router.push("/dashboard");
    return null;
  }

  // Authenticated Admin UI
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-red-700 to-red-500 py-20 flex flex-col items-center text-center gap-6">
      <h1 className="text-4xl sm:text-5xl font-bold text-white">👑 Admin Panel</h1>

      <p className="text-white text-lg">
        Logged in as <span className="font-bold">{session.user.email}</span>
      </p>

      <p className="text-white">
        This page is restricted to <strong>ADMIN</strong> users only.
      </p>

      {/* Example admin-only content */}
      <div className="mt-6 bg-white p-6 rounded-lg shadow text-gray-800">
        <h2 className="text-xl font-bold">Admin Tools</h2>
        <ul className="list-disc list-inside mt-3">
          <li>Manage all businesses</li>
          <li>View system-wide reports</li>
          <li>Handle escalated issues</li>
        </ul>
      </div>
    </section>
  );
}

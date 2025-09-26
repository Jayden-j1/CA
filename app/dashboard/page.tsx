// app/dashboard/page.tsx
//
// Purpose:
// - Root dashboard landing page content only.
// - Redirects unauthenticated users to /login.
// - Displays user info, role, and personalized greeting.
// - Navigation + logout are now handled by app/dashboard/layout.tsx,
//   so this page is focused only on showing role-aware content.
//
// Dependencies:
// - next-auth/react (session)
// - next/navigation (redirects)
// - FullPageSpinner (loading state UI)

"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import FullPageSpinner from "@/components/ui/fullPageSpinner";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // --- Redirect unauthenticated users ---
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // --- Show full-page spinner while checking session ---
  if (status === "loading") {
    return <FullPageSpinner message="Loading your dashboard..." />;
  }

  // --- If session is missing (redirect in progress), show nothing ---
  if (!session?.user) {
    return null;
  }

  const role = session.user.role; // e.g., "USER" | "BUSINESS_OWNER" | "ADMIN"

  // --- Role-aware greeting ---
  let greeting = "Welcome back!";
  if (role === "BUSINESS_OWNER") greeting = "🎉 Welcome back, Business Owner!";
  if (role === "USER") greeting = "🎉 Welcome back!";
  if (role === "ADMIN") greeting = "👑 Welcome back, Admin!";

  // --- Authenticated Dashboard Content ---
  return (
    <section className="w-full py-10 flex flex-col items-center text-center gap-6">
      {/* Greeting headline */}
      <h1 className="text-4xl sm:text-5xl font-bold text-black">{greeting}</h1>

      {/* User info */}
      <p className="text-white text-lg">
        Logged in as <span className="font-bold">{session.user.email}</span>
      </p>
      <p className="text-white">Role: {role}</p>

      {/* Example dashboard-specific content */}
      <p className="mt-4 text-black">
        This is your personalised dashboard. Use the top navigation bar to navigate.
      </p>
    </section>
  );
}

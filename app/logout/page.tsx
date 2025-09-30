// app/logout/page.tsx
//
// Purpose:
// - Provide a real /logout route (so clicking "Logout" never 404s).
// - On mount, call NextAuth's `signOut()` and redirect to home with a flag:
//     /?logout=success
//   → This can trigger your existing LogoutToast component on the homepage.
//
// Behavior:
// - Client-only component (signOut is a client call).
// - Shows a tiny fallback text in case redirect is slow (optional).
//
// Requirements:
// - Make sure you render <LogoutToast /> somewhere on your home page or root
//   layout, so the "logout=success" query shows a toast.

"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

export default function LogoutPage() {
  useEffect(() => {
    // Build a callbackUrl back to home with a toast flag
    const callbackUrl = `${window.location.origin}/?logout=success`;

    // Call NextAuth signOut — this clears the session and then redirects
    // to the provided `callbackUrl`.
    signOut({ callbackUrl });
  }, []);

  // Optional: minimal fallback in case redirect takes a moment.
  return (
    <section className="w-full min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-600">Signing you out...</p>
    </section>
  );
}

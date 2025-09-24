// app/layout.tsx
//
// Purpose:
// - Global layout wrapper for *all* pages.
// - Wraps the app with SessionProvider so useSession() works everywhere.
// - Conditionally renders PublicNavbar + Footer ONLY on non-dashboard pages.
// - Dashboard routes (/dashboard/*) rely on app/dashboard/layout.tsx instead.
//
// How it works:
// - We check current pathname with `usePathname()` (Next.js App Router).
// - If pathname starts with "/dashboard", we skip rendering PublicNavbar and Footer.

"use client";

import { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { usePathname } from "next/navigation"; // ✅ to check current route
import "./globals.css";

import { PublicNavbar } from "@/components/Header/NavBar";
import Footer from "@/components/Footer/footer";
import SessionProviderWrapper from "@/components/providers/SessionProviderWrapper";

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const pathname = usePathname();

  // ✅ Detect if we're in the dashboard
  const isDashboard = pathname?.startsWith("/dashboard");

  return (
    <html lang="en">
      <body>
        <SessionProviderWrapper>
          {/* ✅ Only show PublicNavbar if NOT in dashboard */}
          {!isDashboard && <PublicNavbar />}

          {/* ✅ Global toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#1e3a8a", // Tailwind blue-800
                color: "#fff",
                borderRadius: "12px",
                padding: "12px 16px",
                fontSize: "0.9rem",
                fontWeight: "500",
              },
              success: {
                style: { background: "#16a34a", color: "#fff" },
                iconTheme: { primary: "#fff", secondary: "#16a34a" },
              },
              error: {
                style: { background: "#dc2626", color: "#fff" },
                iconTheme: { primary: "#fff", secondary: "#dc2626" },
              },
            }}
          />

          {/* ✅ Route-specific content */}
          {children}

          {/* ✅ Only show Footer if NOT in dashboard */}
          {!isDashboard && <Footer />}
        </SessionProviderWrapper>
      </body>
    </html>
  );
}










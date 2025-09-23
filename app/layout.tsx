// app/layout.tsx
//
// Purpose:
// - Global layout wrapper for all *public* pages (outside dashboard).
// - Wraps the app with SessionProvider so useSession() works globally.
// - Displays PublicNavbar at the top and Footer at the bottom.
// - Provides a global toast system with custom styling.

import { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import "./globals.css";

// ✅ New: use PublicNavbar instead of the generic Navbar
import { PublicNavbar } from "@/components/Header/NavBar";
import Footer from "@/components/Footer/footer";
import SessionProviderWrapper from "@/components/providers/SessionProviderWrapper";

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        {/* ✅ SessionProvider ensures useSession() works anywhere */}
        <SessionProviderWrapper>
          {/* ✅ Public navbar shown on all non-dashboard pages */}
          <PublicNavbar />

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

          {/* Page-specific content */}
          {children}

          {/* ✅ Footer on all public pages */}
          <Footer />
        </SessionProviderWrapper>
      </body>
    </html>
  );
}









// // app/layout.tsx
// //
// // Purpose:
// // - Global layout wrapper for the app (Next.js App Router).
// // - Wraps all pages in NextAuth's SessionProvider (via SessionProviderWrapper)
// //   so hooks like useSession() work anywhere in the app.
// // - Still renders Navbar and Footer globally.
// // - Provides a global Toaster with custom theme matching the dashboard.
// //
// // Notes:
// // - Only change from the previous version is adding SessionProviderWrapper.

// import { ReactNode } from "react";
// import { Toaster } from "react-hot-toast"; //  Global toast system
// import { Geist, Geist_Mono } from "next/font/google"; // (optional font imports to use)
// import "./globals.css";
// import Navbar from "@/components/Header/NavBar";
// import Footer from "@/components/Footer/footer";
// import SessionProviderWrapper from "@/components/providers/SessionProviderWrapper"; // ✅ new import

// // Explicitly type the props for clarity
// interface RootLayoutProps {
//   children: ReactNode; // Covers any valid JSX content
// }

// export default function RootLayout({ children }: RootLayoutProps) {
//   return (
//     <html lang="en">
//       <body>
//         {/* ✅ Wrap entire app in SessionProvider so useSession works */}
//         <SessionProviderWrapper>
//           {/* Navbar visible on all pages */}
//           <Navbar />

//           {/* Global Toaster (toast notifications anywhere in the app) */}
//           <Toaster
//             position="top-right"
//             toastOptions={{
//               // Default styling (blue background, white text)
//               style: {
//                 background: "#1e3a8a", // Tailwind blue-800
//                 color: "#fff",
//                 borderRadius: "12px",
//                 padding: "12px 16px",
//                 fontSize: "0.9rem",
//                 fontWeight: "500",
//               },
//               // Success notifications
//               success: {
//                 style: {
//                   background: "#16a34a", // Tailwind green-600
//                   color: "#fff",
//                 },
//                 iconTheme: {
//                   primary: "#fff",
//                   secondary: "#16a34a",
//                 },
//               },
//               // Error notifications
//               error: {
//                 style: {
//                   background: "#dc2626", // Tailwind red-600
//                   color: "#fff",
//                 },
//                 iconTheme: {
//                   primary: "#fff",
//                   secondary: "#dc2626",
//                 },
//               },
//             }}
//           />

//           {/* Page content (changes depending on the route) */}
//           {children}

//           {/* Footer visible on all pages */}
//           <Footer />
//         </SessionProviderWrapper>
//       </body>
//     </html>
//   );
// }









// // // app/layout.tsx
// // //
// // // Purpose:
// // // - Global layout wrapper for the app (Next.js App Router).
// // // - Renders Navbar and Footer on every page.
// // // - Provides a global Toaster (react-hot-toast) with a custom theme
// // //   matching the blue/green dashboard styling.
// // // - Ensures consistent toast notifications across all forms and pages.

// // import { ReactNode } from "react";
// // import { Toaster } from "react-hot-toast"; //  Global toast system
// // import { Geist, Geist_Mono } from "next/font/google"; // (optional font imports to use)
// // import "./globals.css";
// // import Navbar from "@/components/Header/NavBar";
// // import Footer from "@/components/Footer/footer";

// // // Explicitly type the props for clarity
// // interface RootLayoutProps {
// //   children: ReactNode; // Covers any valid JSX content
// // }

// // export default function RootLayout({ children }: RootLayoutProps) {
// //   return (
// //     <html lang="en">
// //       <body>
// //         {/*  Navbar visible on all pages */}
// //         <Navbar />

// //         {/*  Global Toaster (toast notifications anywhere in the app) */}
// //         <Toaster
// //           position="top-right" // Place notifications at top-right of screen
// //           toastOptions={{
// //             //  Default styling (blue background, white text)
// //             style: {
// //               background: "#1e3a8a", // Tailwind blue-800
// //               color: "#fff",
// //               borderRadius: "12px",
// //               padding: "12px 16px",
// //               fontSize: "0.9rem",
// //               fontWeight: "500",
// //             },
// //             //  Success notifications
// //             success: {
// //               style: {
// //                 background: "#16a34a", // Tailwind green-600
// //                 color: "#fff",
// //               },
// //               iconTheme: {
// //                 primary: "#fff",
// //                 secondary: "#16a34a",
// //               },
// //             },
// //             //  Error notifications
// //             error: {
// //               style: {
// //                 background: "#dc2626", // Tailwind red-600
// //                 color: "#fff",
// //               },
// //               iconTheme: {
// //                 primary: "#fff",
// //                 secondary: "#dc2626",
// //               },
// //             },
// //           }}
// //         />

// //         {/*  Page content (changes depending on the route) */}
// //         {children}

// //         {/*  Footer visible on all pages */}
// //         <Footer />
// //       </body>
// //     </html>
// //   );
// // }








// // import { ReactNode } from "react";
// // import { Toaster } from "react-hot-toast";
// // import { Geist, Geist_Mono } from "next/font/google";
// // import "./globals.css";
// // import Navbar from '@/components/Header/NavBar';
// // import Footer from '@/components/Footer/footer';



// // // Explicitly type the props
// // interface RootLayoutProps {
// //   children: ReactNode; // Covers any valid JSX content
// // }

// // export default function RootLayout({ children }: RootLayoutProps) {
// //   return (
// //     <html lang="en">
// //       <body>
// //         <Navbar /> {/* Displayed on every page */}
// //         {children} {/* Page content */}
// //         <Footer /> {/* Displayed on every page */}
// //       </body>
// //     </html>
// //   );
// // }

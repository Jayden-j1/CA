"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react"; //  import useState
import Link from "next/link";
import ButtonWithSpinner from "@/components/ui/buttonWithSpinner";
import FullPageSpinner from "@/components/ui/fullPageSpinner";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();


  //  Define state to track when logout is in progress
  // loggingOut → true = spinner shows inside logout button
  const [loggingOut, setLoggingOut] = useState(false);

  // --- Redirect if unauthenticated ---
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // --- Loading state: full page spinner ---
  if (status === "loading") {
    return <FullPageSpinner message="Loading your dashboard..." />;
  }

  // --- No session but not loading (redirect already triggered) ---
  if (!session?.user) {
    return null;
  }

  const role = session.user.role;

  // --- Role-aware greeting ---
  let greeting = "Welcome back!";
  if (role === "BUSINESS_OWNER") greeting = "🎉 Welcome back, Business Owner!";
  if (role === "USER") greeting = "🎉 Welcome back!";
  if (role === "ADMIN") greeting = "👑 Welcome back, Admin!";

  // --- Authenticated Dashboard ---
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center text-center gap-6">
      <h1 className="text-4xl sm:text-5xl font-bold text-white">{greeting}</h1>

      {/* User Info */}
      <p className="text-white text-lg">
        Logged in as <span className="font-bold">{session.user.email}</span>
      </p>
      <p className="text-white">Role: {role}</p>

      {/* Navigation Links */}
      <div className="flex gap-6 mt-6">
        <Link
          href="/"
          className="px-6 py-3 bg-white text-blue-700 font-bold rounded-lg shadow hover:bg-gray-200"
        >
          Home
        </Link>

        {role === "BUSINESS_OWNER" && (
          <>
            <Link
              href="/dashboard/staff"
              className="px-6 py-3 bg-white text-blue-700 font-bold rounded-lg shadow hover:bg-gray-200"
            >
              Manage Staff
            </Link>
            <Link
              href="/dashboard/add-staff"
              className="px-6 py-3 bg-white text-blue-700 font-bold rounded-lg shadow hover:bg-gray-200"
            >
              Add Staff
            </Link>
          </>
        )}
      </div>

      {/* Logout Button with spinner */}
      <ButtonWithSpinner
        onClick={async () => {
          setLoggingOut(true); // ✅ show spinner
          await signOut({ callbackUrl: "/" });
        }}
        loading={loggingOut} // ✅ controlled by state
        className="mt-8 bg-red-600 hover:bg-red-500"
      >
        Logout
      </ButtonWithSpinner>
    </section>
  );
}









// // app/dashboard/page.tsx
// //
// // Purpose:
// // - Root dashboard landing page.
// // - Uses useSession() to check authentication.
// // - Redirects logged-out users to /login.
// // - Shows a Spinner while session is being checked (loading state).
// // - Displays user info, role, and role-aware greeting when logged in.
// // - Provides role-based navigation with links for USER, BUSINESS_OWNER, ADMIN.
// //
// // Dependencies:
// // - next-auth (for session & signOut).
// // - next/navigation (for router redirects).
// // - next/link (for navigation links).
// // - Spinner (our reusable loading component).

// "use client";

// import { useSession, signOut } from "next-auth/react";
// import { useRouter } from "next/navigation";
// import { useEffect,useState } from "react";
// import Link from "next/link";
// import ButtonWithSpinner from "@/components/ui/buttonWithSpinner"; //  reusable spinner
// import FullPageSpinner from "@/components/ui/fullPageSpinner"; // Full page spinner

// export default function DashboardPage() {
//   const { data: session, status } = useSession();
//   const router = useRouter();

//   // --- Redirect if unauthenticated ---
//   useEffect(() => {
//     if (status === "unauthenticated") {
//       router.push("/login");
//     }
//   }, [status, router]);

//   // --- Loading state: show spinner ---
//   if (status === "loading") {
//     return <FullPageSpinner message="Loading your dashboard..." />;
//   }

//   // --- No session but not loading (redirect already triggered) ---
//   if (!session?.user) {
//     return null;
//   }

//   const role = session.user.role;

//   // --- Role-aware greeting ---
//   let greeting = "Welcome back!";
//   if (role === "BUSINESS_OWNER") greeting = "🎉 Welcome back, Business Owner!";
//   if (role === "USER") greeting = "🎉 Welcome back!";
//   if (role === "ADMIN") greeting = "👑 Welcome back, Admin!";

//   // --- Authenticated Dashboard ---
//   return (
//     <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center text-center gap-6">
//       <h1 className="text-4xl sm:text-5xl font-bold text-white">{greeting}</h1>

//       {/* User Info */}
//       <p className="text-white text-lg">
//         Logged in as <span className="font-bold">{session.user.email}</span>
//       </p>
//       <p className="text-white">Role: {role}</p>

//       {/* Navigation Links */}
//       <div className="flex gap-6 mt-6">
//         <Link
//           href="/"
//           className="px-6 py-3 bg-white text-blue-700 font-bold rounded-lg shadow hover:bg-gray-200"
//         >
//           Home
//         </Link>

//         {role === "BUSINESS_OWNER" && (
//           <>
//             <Link
//               href="/dashboard/staff"
//               className="px-6 py-3 bg-white text-blue-700 font-bold rounded-lg shadow hover:bg-gray-200"
//             >
//               Manage Staff
//             </Link>
//             <Link
//               href="/dashboard/add-staff"
//               className="px-6 py-3 bg-white text-blue-700 font-bold rounded-lg shadow hover:bg-gray-200"
//             >
//               Add Staff
//             </Link>
//           </>
//         )}
//       </div>

//       {/* Logout Button with Spinner */}
//       <ButtonWithSpinner
//         onClick={async () => {
//           setLoggingOut(true); // show spinner
//           await signOut({ callbackUrl: "/" });
//         }}
//         loading={loggingOut}
//         className="mt-8 bg-red-600 hover:bg-red-500"
//       >
//         Logout
//       </ButtonWithSpinner>
//     </section>
//   );
// }









// // app/dashboard/page.tsx
// //
// // Purpose:
// // - Root dashboard landing page.
// // - Uses useSession() to check authentication.
// // - Redirects logged-out users to /login.
// // - Shows a spinner while session is being checked (loading state).
// // - Displays user info, role, and role-aware greeting when logged in.
// // - Provides role-based navigation:
// //   - USER → basic info + home link
// //   - BUSINESS_OWNER → adds staff management links
// //   - ADMIN (future-ready) → can extend for admin panel
// //
// // Dependencies:
// // - next-auth (for session & signOut).
// // - next/navigation (for router redirects).
// // - next/link (for navigation links).


// import Spinner from "@/components/ui/spinner"; //  import spinner

// "use client";

// import { useSession, signOut } from "next-auth/react";
// import { useRouter } from "next/navigation";
// import { useEffect } from "react";
// import Link from "next/link";

// export default function DashboardPage() {
//   const { data: session, status } = useSession(); // NextAuth session hook
//   const router = useRouter();

//   // --- Handle unauthenticated state ---
//   useEffect(() => {
//     if (status === "unauthenticated") {
//       router.push("/login"); // 🚀 Redirect to login
//     }
//   }, [status, router]);

//   // --- Handle loading state ---
//   if (status === "loading") {
//     return (
//       <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
//         {/* Spinner with message */}
//         <div className="flex items-center gap-3 text-white text-xl">
//           <svg
//             className="animate-spin h-8 w-8 text-green-500"
//             xmlns="http://www.w3.org/2000/svg"
//             fill="none"
//             viewBox="0 0 24 24"
//           >
//             <circle
//               className="opacity-25"
//               cx="12"
//               cy="12"
//               r="10"
//               stroke="currentColor"
//               strokeWidth="4"
//             ></circle>
//             <path
//               className="opacity-75"
//               fill="currentColor"
//               d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
//             ></path>
//           </svg>
//           <span>Loading your dashboard...</span>
//         </div>
//       </section>
//     );
//   }

//   // --- If no session but not loading (redirect in progress) ---
//   if (!session?.user) {
//     return null; // nothing shows while redirect happens
//   }

//   const role = session.user.role; // e.g., "USER" or "BUSINESS_OWNER"

//   // --- Role-aware greeting ---
//   let greeting = "Welcome back!";
//   if (role === "BUSINESS_OWNER") {
//     greeting = "🎉 Welcome back, Business Owner!";
//   } else if (role === "USER") {
//     greeting = "🎉 Welcome back!";
//   } else if (role === "ADMIN") {
//     greeting = "👑 Welcome back, Admin!";
//   }

//   // --- Authenticated Dashboard UI ---
//   return (
//     <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center text-center gap-6">
//       {/* Role-aware greeting headline */}
//       <h1 className="text-4xl sm:text-5xl font-bold text-white">{greeting}</h1>

//       {/* User Info */}
//       <p className="text-white text-lg">
//         Logged in as <span className="font-bold">{session.user.email}</span>
//       </p>
//       <p className="text-white">Role: {role}</p>

//       {/* Navigation Links */}
//       <div className="flex gap-6 mt-6">
//         {/* Always visible */}
//         <Link
//           href="/"
//           className="px-6 py-3 bg-white text-blue-700 font-bold rounded-lg shadow hover:bg-gray-200"
//         >
//           Home
//         </Link>

//         {/* Only BUSINESS_OWNER can manage staff */}
//         {role === "BUSINESS_OWNER" && (
//           <>
//             <Link
//               href="/dashboard/staff"
//               className="px-6 py-3 bg-white text-blue-700 font-bold rounded-lg shadow hover:bg-gray-200"
//             >
//               Manage Staff
//             </Link>
//             <Link
//               href="/dashboard/add-staff"
//               className="px-6 py-3 bg-white text-blue-700 font-bold rounded-lg shadow hover:bg-gray-200"
//             >
//               Add Staff
//             </Link>
//           </>
//         )}
//       </div>

//       {/* Logout Button */}
//       <button
//         onClick={() => signOut({ callbackUrl: "/" })}
//         className="mt-8 px-6 py-3 bg-red-600 text-white font-bold rounded-lg shadow hover:bg-red-500"
//       >
//         Logout
//       </button>
//     </section>
//   );
// }









// // app/dashboard/page.tsx
// //
// // Root dashboard landing page
// // - Redirects logged-out users to /login (better UX than just showing a message).
// // - Displays user info and role once logged in.
// // - Role-based navigation:
// //   - USER → sees only basic info + home link
// //   - BUSINESS_OWNER → also sees staff management links
// //   - ADMIN (future) → could see admin panel
// //
// // Dependencies: next-auth (for session), next/navigation (for router)

// 'use client';

// import { useSession, signOut } from "next-auth/react";
// import { useRouter } from "next/navigation";
// import { useEffect } from "react";
// import Link from "next/link";

// export default function DashboardPage() {
//   const { data: session, status } = useSession(); // NextAuth session
//   const router = useRouter();

//   // Redirect if not logged in
//   useEffect(() => {
//     if (status === "unauthenticated") {
//       router.push("/login"); // 🚀 send user to login page
//     }
//   }, [status, router]);

//   // While checking session, show a loading state
//   if (status === "loading") {
//     return (
//       <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
//         <p className="text-white text-xl">Loading your dashboard...</p>
//       </section>
//     );
//   }

//   // If no session (but status not loading), we already redirected.
//   if (!session?.user) {
//     return null; // Nothing renders while redirect happens
//   }

//   const role = session.user.role; // e.g., "USER" or "BUSINESS_OWNER"

//   return (
//     <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center text-center gap-6">
//       <h1 className="text-4xl sm:text-5xl font-bold text-white">
//         Welcome to your Dashboard 🎉
//       </h1>

//       {/* User info */}
//       <p className="text-white text-lg">
//         Logged in as <span className="font-bold">{session.user.email}</span>
//       </p>
//       <p className="text-white">Role: {role}</p>

//       {/* Navigation Links */}
//       <div className="flex gap-6 mt-6">
//         {/* Always visible */}
//         <Link
//           href="/"
//           className="px-6 py-3 bg-white text-blue-700 font-bold rounded-lg shadow hover:bg-gray-200"
//         >
//           Home
//         </Link>

//         {/* Only BUSINESS_OWNER can manage staff */}
//         {role === "BUSINESS_OWNER" && (
//           <>
//             <Link
//               href="/dashboard/staff"
//               className="px-6 py-3 bg-white text-blue-700 font-bold rounded-lg shadow hover:bg-gray-200"
//             >
//               Manage Staff
//             </Link>
//             <Link
//               href="/dashboard/add-staff"
//               className="px-6 py-3 bg-white text-blue-700 font-bold rounded-lg shadow hover:bg-gray-200"
//             >
//               Add Staff
//             </Link>
//           </>
//         )}
//       </div>

//       {/* Logout */}
//       <button
//         onClick={() => signOut({ callbackUrl: "/" })}
//         className="mt-8 px-6 py-3 bg-red-600 text-white font-bold rounded-lg shadow hover:bg-red-500"
//       >
//         Logout
//       </button>
//     </section>
//   );
// }





















// app/dashboard/page.tsx
//
// Root dashboard landing page
// - Prevents 404 after login (NextAuth redirects here by default).
// - Shows different navigation options based on user role.
//   - USER: Can log in and see their info, but no staff management.
//   - BUSINESS_OWNER: Can manage staff (staff list + add staff).
//   - ADMIN: You could later extend to full control.
// - Includes a logout button using NextAuth's `signOut`.

// 'use client';

// import { useSession, signOut } from "next-auth/react";
// import Link from "next/link";

// export default function DashboardPage() {
//   // Get the current session from NextAuth
//   const { data: session } = useSession();

//   // If user is not logged in, we show a simple message.
//   // (You could also redirect to /login here if you prefer.)
//   if (!session?.user) {
//     return (
//       <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
//         <p className="text-white text-xl">⚠️ You must log in to access the dashboard.</p>
//       </section>
//     );
//   }

//   // Extract role for convenience
//   const role = session.user.role;

//   return (
//     <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center text-center gap-6">
//       <h1 className="text-4xl sm:text-5xl font-bold text-white">Welcome to your Dashboard 🎉</h1>

//       {/* Show logged-in user info */}
//       <p className="text-white text-lg">
//         Logged in as <span className="font-bold">{session.user.email}</span>
//       </p>
//       <p className="text-white">Role: {role}</p>

//       {/* Navigation links depend on role */}
//       <div className="flex gap-6 mt-6">
//         {/* Always visible: a generic home/dashboard link */}
//         <Link
//           href="/"
//           className="px-6 py-3 bg-white text-blue-700 font-bold rounded-lg shadow hover:bg-gray-200"
//         >
//           Home
//         </Link>

//         {/* Only BUSINESS_OWNERs can manage staff */}
//         {role === "BUSINESS_OWNER" && (
//           <>
//             <Link
//               href="/dashboard/staff"
//               className="px-6 py-3 bg-white text-blue-700 font-bold rounded-lg shadow hover:bg-gray-200"
//             >
//               Manage Staff
//             </Link>
//             <Link
//               href="/dashboard/add-staff"
//               className="px-6 py-3 bg-white text-blue-700 font-bold rounded-lg shadow hover:bg-gray-200"
//             >
//               Add Staff
//             </Link>
//           </>
//         )}

//         {/* Optional: if ADMIN, show extra controls */}
//         {role === "ADMIN" && (
//           <Link
//             href="/admin"
//             className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg shadow hover:bg-red-500"
//           >
//             Admin Panel
//           </Link>
//         )}
//       </div>

//       {/* Logout button */}
//       <button
//         onClick={() => signOut({ callbackUrl: "/" })}
//         className="mt-8 px-6 py-3 bg-red-600 text-white font-bold rounded-lg shadow hover:bg-red-500"
//       >
//         Logout
//       </button>
//     </section>
//   );
// }

// app/dashboard/map/page.tsx
//
// Purpose:
// - Interactive Map page inside the dashboard.
// - Accessible ONLY if the logged-in user has a successful payment record.
// - If not, user is redirected to /dashboard/upgrade.
//
// Notes:
// - Middleware ensures user is logged in.
// - Prisma + getServerSession checks for valid purchase.

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function MapPage() {
  // 1️. Get the current session (must exist due to middleware)
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    // Extra safeguard → should never happen
    redirect("/login");
  }

  // 2️. Check if this user has made at least one payment
  const payment = await prisma.payment.findFirst({
    where: { userId: session.user.id },
  });

  if (!payment) {
    // 🚫 No payment found → redirect to upgrade page
    redirect("/dashboard/upgrade");
  }

  // 3️. If payment exists → render the map page
  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-8">
        Interactive Map
      </h1>

      {/* ✅ Placeholder for your actual map component */}
      <div className="w-[90%] sm:w-[600px] md:w-[900px] bg-white rounded-xl shadow-xl p-6">
        <p className="text-gray-700">
          🌍 Map content goes here (only visible to paid users).
        </p>
      </div>
    </section>
  );
}









// 'use client';
// import dynamic from 'next/dynamic';
// import TopofPageContent from '../../components/topPage/topOfPageStyle';

// // Load the map component only on the client
// const GoogleMapComponent = dynamic(
//   () => import('../../components/GoogleMap/GoogleMapComponent'),
//   { ssr: false }
// );

// export default function MapsPage() {
//   return (
//     <>
//       <TopofPageContent
//         HeadingOneTitle="Map Boundary"
//         paragraphContent="Placeholder text for now"
//       />
//       <div className="mt-10">
//         <GoogleMapComponent />
//       </div>
//     </>
//   );
// }










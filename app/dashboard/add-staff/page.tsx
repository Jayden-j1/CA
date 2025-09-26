// app/dashboard/add-staff/page.tsx
//
// Purpose:
// - Restricts access to BUSINESS_OWNER.
// - Renders the updated AddStaffForm with "Make Admin" option.

'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AddStaffForm from "@/components/forms/addStaffForm";

export default function AddStaffPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && session?.user.role !== "BUSINESS_OWNER") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
        <p className="text-white text-xl">Loading add-staff page...</p>
      </section>
    );
  }

  if (!session?.user || session.user.role !== "BUSINESS_OWNER") {
    return null;
  }

  return (
    <section className="w-full flex flex-col justify-center items-center bg-gradient-to-b from-blue-700 to-blue-300 min-h-screen py-20">
      <h2 className="text-white font-bold text-3xl sm:text-4xl md:text-5xl tracking-wide mb-8 text-center">
        Add Staff User
      </h2>
      <AddStaffForm />
    </section>
  );
}

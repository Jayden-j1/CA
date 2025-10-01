// app/reset-password/[token]/page.tsx
//
// Purpose:
// - Public page that renders ResetPasswordForm with the token from the URL.
// - Keeps UI minimal and consistent with your other pages.

"use client";

import ResetPasswordForm from "@/components/forms/ResetPassword";

export default function ResetPasswordPage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;

  return (
    <section className="w-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
      <h1 className="text-white font-bold text-3xl sm:text-4xl md:text-5xl mb-6">
        Choose a new password
      </h1>
      <ResetPasswordForm token={token} />
    </section>
  );
}

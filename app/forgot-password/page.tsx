// app/forgot-password/page.tsx
//
// Purpose:
// - Public page to request a password reset link.
// - Renders the ForgotPasswordForm in your site styling.

"use client";

import ForgotPasswordForm from "@/components/forms/ForgotPassword";

export default function ForgotPasswordPage() {
  return (
    <section className="w-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
      <h1 className="text-white font-bold text-3xl sm:text-4xl md:text-5xl mb-6">
        Forgot your password?
      </h1>
      <ForgotPasswordForm />
    </section>
  );
}

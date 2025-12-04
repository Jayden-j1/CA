// app/forgot-password/page.tsx
//
// Purpose
// -------
// Public-facing "Forgot Password" page.
// - Wraps the existing <ForgotPasswordForm /> in a familiar, branded layout.
// - Keeps styling consistent with your login/signup gradient + card patterns.
// - Does NOT implement any business logic itself: the form handles everything.
//
// Why this version?
// -----------------
// - Your logic for posting to /api/auth/forgot-password and showing the
//   neutral toast already lives in components/forms/ForgotPasswordForm.tsx.
// - Centralising that logic there avoids duplication and keeps this page
//   focused purely on layout.
//
// Pillars
// -------
// - Simplicity: This page is just a shell around a well-defined form.
// - Robustness: All logic (fetch + toast) remains in one place.
// - Security: No additional data handling here.
// - Consistency: Matches your existing gradient + card auth styling.

"use client";

import ForgotPasswordForm from "@/components/forms/ForgotPassword";

export default function ForgotPasswordPage() {
  return (
    <main
      className="
        min-h-screen
        w-full
        bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600
        flex
        items-center
        justify-center
        px-4
        py-10
      "
    >
      {/*
        Outer card container:
        - Semi-transparent white over the blue gradient for readability.
        - Rounded corners + shadow for a professional "auth card" look.
        - Max-width so copy doesn't stretch too wide on large monitors.
      */}
      <section
        className="
          w-full
          max-w-xl
          bg-white/10
          border border-white/20
          rounded-3xl
          shadow-2xl
          backdrop-blur-sm
          flex
          flex-col
          items-center
          py-8
          sm:py-10
        "
      >
        {/* Page heading + short explanation */}
        <header className="w-full px-6 sm:px-8 mb-4 text-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
            Forgot your password?
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-white/90 leading-relaxed">
            Enter the email linked to your account. If it exists, we&rsquo;ll
            send you a secure link to reset your password.
          </p>
        </header>

        {/*
          Existing ForgotPasswordForm:
          - Handles:
            • local email state,
            • POST /api/auth/forgot-password,
            • generic toast: "If that email exists, a reset link has been sent."
          - We do *not* re-implement that logic here. This keeps behaviour
            identical to your previous, working implementation — just in
            a better-organised place.
        */}
        <ForgotPasswordForm />
      </section>
    </main>
  );
}










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









// // app/forgot-password/page.tsx
// //
// // Purpose:
// // - Client page for requesting a password reset.
// // - Posts to /api/auth/forgot-password.
// // - Shows a unified toast: “If that email exists, a reset link has been sent.”
// //
// // Surgical updates:
// // - Trim/lower email before submit to match server normalization.
// // - Minor a11y/UX touchups. No changes to your app layout or routes.
// //
// // Prereq:
// // - Ensure <Toaster /> is mounted in your root layout.

// "use client";

// import { useState } from "react";
// import toast from "react-hot-toast";

// export default function ForgotPasswordPage() {
//   const [email, setEmail] = useState("");
//   const [loading, setLoading] = useState(false);

//   async function onSubmit(e: React.FormEvent) {
//     e.preventDefault();
//     const normalized = email.trim().toLowerCase();
//     if (!normalized) {
//       toast.error("Please enter your email.");
//       return;
//     }

//     setLoading(true);

//     try {
//       const res = await fetch("/api/auth/forgot-password", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ email: normalized }),
//       });

//       // We always show success toast to avoid user enumeration
//       if (res.ok) {
//         toast.success("If that email exists, a reset link has been sent.");
//         setEmail("");
//       } else {
//         // Even non-200 should be rare; keep this generic for consistency.
//         toast.success("If that email exists, a reset link has been sent.");
//       }
//     } catch (err) {
//       console.error("[ForgotPasswordPage] Error:", err);
//       toast.success("If that email exists, a reset link has been sent.");
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <section className="min-h-[70vh] flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
//       <form
//         onSubmit={onSubmit}
//         className="w-[90%] max-w-md bg-white rounded-xl shadow p-6 space-y-4"
//         aria-busy={loading}
//       >
//         <h1 className="text-xl font-bold">Forgot your password?</h1>
//         <p className="text-sm text-gray-600">
//           Enter your email and we’ll send a link to reset your password.
//         </p>

//         <label htmlFor="fp-page-email" className="block text-sm font-semibold">Email</label>
//         <input
//           id="fp-page-email"
//           type="email"
//           required
//           value={email}
//           onChange={(e) => setEmail(e.target.value)}
//           className="w-full border rounded px-3 py-2"
//           placeholder="you@company.com"
//           autoComplete="email"
//         />

//         <button
//           type="submit"
//           disabled={loading}
//           className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-500 disabled:opacity-60"
//           aria-busy={loading}
//         >
//           {loading ? "Sending..." : "Send reset link"}
//         </button>

//         <p className="text-xs text-gray-500">
//           <a href="/login" className="underline">Back to login</a>
//         </p>
//       </form>
//     </section>
//   );
// }

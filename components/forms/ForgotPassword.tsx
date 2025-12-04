// components/forms/ForgotPassword.tsx
//
// Purpose
// -------
// - Simple form that collects a user’s email and calls /api/auth/forgot-password.
// - Shows a *generic* success toast regardless of whether the email exists
//   (prevents attackers from enumerating valid accounts).
// - Keeps UI minimal, friendly, and consistent with your auth styling.
//
// Behaviour
// ---------
// - Normalises email (trim + lowercase) before sending to the API.
// - Disables the button and marks the form as busy while sending.
// - Always shows: "If that email exists, a reset link has been sent."
//   on both success and failure (network/server).
//
// UX Update in this revision
// --------------------------
// - Adds a small "Back to login" link below the helper text, restoring
//   the navigation affordance from your older page while keeping the
//   new, centralised form logic.
//
// Pillars
// -------
// - Simplicity: one small, focused form component.
// - Robustness: tolerant to API/network failures; consistent messaging.
// - Security: no user enumeration; minimal data handling.
// - Consistency: matches the gradient/card auth look + provides a
//   clear route back to login.

"use client";

import { useState, FormEvent } from "react";
import toast from "react-hot-toast";

export default function ForgotPasswordForm() {
  // Email the user enters
  const [email, setEmail] = useState("");
  // UI loading flag to disable the button and show "Sending..."
  const [loading, setLoading] = useState(false);

  // Handle form submission
  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    // Normalise the email to match server-side lookup behaviour
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      // Immediate client-side guard to avoid pointless API calls
      toast.error("Please enter your email.");
      return;
    }

    setLoading(true);

    try {
      // Fire-and-forget request to the forgot-password API.
      // NOTE:
      // - The API always returns a generic response to avoid
      //   revealing whether the email exists.
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });

      // Always show the same neutral success message, regardless
      //    of whether the email exists or whether the account is active.
      toast.success("If that email exists, a reset link has been sent.", {
        duration: 4000,
      });

      // Clear the field for a clean state
      setEmail("");
    } catch (err) {
      console.error("[ForgotPasswordForm] Error:", err);

      // On network or unexpected errors, we *still* show the same
      //    neutral message to avoid leaking anything.
      toast.success("If that email exists, a reset link has been sent.", {
        duration: 4000,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="
        flex
        flex-col
        gap-4
        p-6 sm:p-8 md:p-10
        w-[90%]
        sm:w-[400px]
        md:w-[450px]
        lg:w-[500px]
      "
      // a11y hint that async work is happening
      aria-busy={loading}
    >
      {/* Label is explicitly associated with the input via htmlFor/id */}
      <label
        htmlFor="fp-email"
        className="text-white font-bold text-sm md:text-base"
      >
        Enter your account email
      </label>

      <input
        id="fp-email"
        type="email"
        value={email}
        required
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
        className="
          block
          w-full
          border-white border-2
          rounded-2xl
          px-4
          py-3
          bg-transparent
          text-white
          placeholder-white
        "
      />

      {/* Submit button with disabled + aria-busy while calling the API */}
      <button
        type="submit"
        disabled={loading}
        className="
          px-8
          py-4
          bg-blue-600
          text-white
          hover:bg-blue-500
          font-bold
          rounded-2xl
          shadow
          border-2 border-white
          disabled:opacity-60
        "
        aria-busy={loading}
      >
        {loading ? "Sending..." : "Send Reset Link"}
      </button>

      {/* Helper copy explaining what to expect */}
      <p className="text-white text-xs opacity-80">
        You&rsquo;ll receive an email with a link to reset your password. If you
        don&rsquo;t see it, please check your spam folder.
      </p>

      {/* Small, unobtrusive link back to the login page for UX consistency */}
      <p className="text-white text-xs opacity-80 mt-1">
        Remembered your password?{" "}
        <a
          href="/login"
          className="underline font-semibold hover:text-blue-100"
        >
          Back to login
        </a>
      </p>
    </form>
  );
}










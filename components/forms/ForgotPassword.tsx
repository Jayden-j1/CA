// components/forms/ForgotPasswordForm.tsx
//
// Purpose:
// - Simple form that collects user email and calls /api/auth/forgot-password.
// - Shows a generic success toast regardless of whether the email exists.
// - Keeps UI minimal and friendly.

"use client";

import { useState, FormEvent } from "react";
import toast from "react-hot-toast";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      // We always show a generic success message to avoid user enumeration
      toast.success("If that email exists, a reset link has been sent.", { duration: 4000 });

      // Optionally clear the form
      setEmail("");
    } catch (err) {
      console.error("[ForgotPasswordForm] Error:", err);
      // Still show the same generic message
      toast.success("If that email exists, a reset link has been sent.", { duration: 4000 });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
    >
      <label htmlFor="email" className="text-white font-bold text-sm md:text-base">
        Enter your account email
      </label>
      <input
        id="email"
        type="email"
        value={email}
        required
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
      />

      <button
        type="submit"
        disabled={loading}
        className="px-8 py-4 bg-blue-600 text-white hover:bg-blue-500 font-bold rounded-2xl shadow border-2 border-white"
      >
        {loading ? "Sending..." : "Send Reset Link"}
      </button>

      <p className="text-white text-xs opacity-80">
        You&rsquo;ll receive an email with a link to reset your password. If you don&rsquo;t see it,
        please check your spam folder.
      </p>
    </form>
  );
}

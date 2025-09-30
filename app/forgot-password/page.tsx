// app/forgot-password/page.tsx
//
// Purpose:
// - Public page where a user can request a password reset link by entering their email.
// - The API will always respond with success to avoid revealing account existence.
// - UI simply shows a success toast and provides instructions.
//
// UX:
// - If email exists and is active → email is sent.
// - If no user or inactive → we still show success to avoid enumeration.
//
// Security: do NOT reveal whether the email is registered.

"use client";

import { useState, FormEvent } from "react";
import toast from "react-hot-toast";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      // We always show success to prevent email enumeration
      if (!res.ok) {
        // For dev-time mistakes, we can still give feedback:
        const data = await res.json().catch(() => ({}));
        console.error("[ForgotPassword] non-200:", data?.error || res.statusText);
      }

      toast.success("If that email exists, a reset link has been sent.", { duration: 4000 });
      setEmail("");
    } catch (err) {
      console.error("[ForgotPassword] error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 flex flex-col items-center justify-center p-6">
      <div className="w-[90%] sm:w-[420px] bg-white rounded-xl shadow-xl p-6">
        <h1 className="text-xl font-bold mb-2">Forgot your password?</h1>
        <p className="text-sm text-gray-600 mb-6">
          Enter your account email and we’ll send you a link to reset your password
          if the account exists.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-semibold">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border rounded px-3 py-2"
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <div className="mt-6 text-sm">
          <Link href="/login" className="text-blue-600 hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </section>
  );
}

// app/reset-password/[token]/page.tsx
//
// Purpose:
// - Public page opened from the email link.
// - Lets the user set a new password (validated on client + server).
// - On success, shows a toast and links back to Login.
//
// Security:
// - We do not render whether token is valid at first; the API will check that on submit.
// - The token comes from the URL segment.

"use client";

import { useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";

// (Optional) Client-side check to reduce round-trips; server validates too.
const clientStrongPassword = (pwd: string) => {
  // Minimum 8 + upper + lower + digit + special
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])(?=.{8,})/.test(pwd);
};

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    if (!clientStrongPassword(password)) {
      toast.error(
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 410) {
          toast.error("Reset link expired. Please request a new one.");
        } else {
          toast.error(data.error || "Invalid or expired link.");
        }
        return;
      }

      toast.success("Password updated! You can now log in.", { duration: 2500 });
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      console.error("[ResetPassword] error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 flex flex-col items-center justify-center p-6">
      <div className="w-[90%] sm:w-[420px] bg-white rounded-xl shadow-xl p-6">
        <h1 className="text-xl font-bold mb-2">Reset your password</h1>
        <p className="text-sm text-gray-600 mb-6">
          Enter a new password for your account.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-sm font-semibold" htmlFor="password">
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="border rounded px-3 py-2"
          />

          <label className="text-sm font-semibold" htmlFor="confirm">
            Confirm new password
          </label>
          <input
            id="confirm"
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="border rounded px-3 py-2"
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-2 px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white font-bold"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </section>
  );
}

// components/forms/ResetPasswordForm.tsx
//
// Purpose
// -------
// - Render two password fields (new + confirm) and submit to /api/auth/reset-password.
// - Enforces strong password on the client (same rule as server).
// - Shows toast + redirects to /login on success.
//
// Notes
// -----
// - UI/logic unchanged; added minor comments for maintainability.

"use client";

import { useState, FormEvent } from "react";
import { isStrongPassword } from "@/lib/validator";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    // Client-side checks for UX (server re-validates)
    if (pw1 !== pw2) {
      toast.error("Passwords do not match.");
      return;
    }
    if (!isStrongPassword(pw1)) {
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
        // Token travels only in the request body; keep it off the URL.
        body: JSON.stringify({ token, password: pw1 }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Token expired or invalid.");
        return;
        // (Optional) You could clear the form / provide a link to request again.
      }

      toast.success("Password reset successful. Please log in.", {
        duration: 3000,
      });
      setTimeout(() => router.push("/login"), 800);
    } catch (err) {
      console.error("[ResetPasswordForm] Error:", err);
      toast.error("Internal error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
    >
      {/* New Password */}
      <label htmlFor="pw1" className="text-white font-bold text-sm md:text-base">
        New Password
      </label>
      <div className="relative">
        <input
          id="pw1"
          type={show1 ? "text" : "password"}
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          required
          className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white"
        />
        <button
          type="button"
          onClick={() => setShow1((s) => !s)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline"
        >
          {show1 ? "Hide" : "Show"}
        </button>
      </div>

      {/* Confirm Password */}
      <label htmlFor="pw2" className="text-white font-bold text-sm md:text-base">
        Confirm Password
      </label>
      <div className="relative">
        <input
          id="pw2"
          type={show2 ? "text" : "password"}
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          required
          className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white"
        />
        <button
          type="button"
          onClick={() => setShow2((s) => !s)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline"
        >
          {show2 ? "Hide" : "Show"}
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-2xl shadow border-2 border-white"
      >
        {loading ? "Saving..." : "Reset Password"}
      </button>

      <p className="text-white text-xs opacity-80">
        Your password must be at least 8 characters and include uppercase, lowercase, number,
        and special character.
      </p>
    </form>
  );
}

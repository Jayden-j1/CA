// app/change-password/page.tsx
//
// Purpose
// -------
// Allow a signed-in user to change their password. This is used when
// mustChangePassword = true (enforced by middleware), but it also works
// if the user navigates here manually.
//
// UX
// --
// - Minimal, focused form.
// - Real-time validation for the new password strength.
// - After success, silently re-authenticate with the new password so the
//   JWT cookie is refreshed (mustChangePassword=false), then redirect.
//
// Security
// --------
// - The API re-checks everything server-side (old password, strength, etc.).
// - This form stores nothing sensitive beyond the local component state.
//
// 🔧 What changed (surgical):
// - After a successful password update, we re-login using NextAuth Credentials
//   and check `signInRes.error` (matching your Login/Signup patterns).
// - If re-login succeeds → router.replace('/dashboard').
// - If re-login fails → toast + router.replace('/login?changed=1').
// - Guard when session email is missing (rare), fall back to /login.
//
// ⚠️ API path note:
// - This page calls POST /api/change-password.
//   If your API route lives at /api/auth/change-password instead, just
//   change the `CHANGE_PW_PATH` constant below. No other logic changes.

"use client";

import { useState, useMemo, FormEvent } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { isStrongPassword } from "@/lib/validator";

const CHANGE_PW_PATH = "/api/change-password"; // change to "/api/auth/change-password" if applicable

export default function ChangePasswordPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // We use session email to silently re-authenticate after changing the password.
  const email = session?.user?.email || "";

  // Local form state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [loading, setLoading] = useState(false);

  // Live complexity validation (client-side convenience; server re-validates)
  const newIsStrong = useMemo(() => isStrongPassword(newPassword), [newPassword]);

  // Enable submit only when the form is valid
  const canSubmit =
    !loading &&
    !!oldPassword &&
    !!newPassword &&
    !!confirmNewPassword &&
    newPassword === confirmNewPassword &&
    newIsStrong;

  // Small helper to safely extract a message from an error response
  async function safeMessage(res: Response): Promise<string | null> {
    try {
      const data = await res.json();
      return data?.error || data?.message || null;
    } catch {
      return res.statusText || null;
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    try {
      // ---------------------------------------------------------
      // 1) Change password server-side
      //    - Server should validate old password, strength, etc.
      //    - Server should set mustChangePassword=false on success.
      // ---------------------------------------------------------
      const res = await fetch(CHANGE_PW_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ oldPassword, newPassword, confirmNewPassword }),
      });

      if (!res.ok) {
        const msg = await safeMessage(res);
        toast.error(msg || "Password change failed");
        return;
      }

      // ---------------------------------------------------------
      // 2) Immediately re-authenticate with the NEW password.
      //    This refreshes the NextAuth JWT in the browser so the
      //    middleware no longer sees mustChangePassword=true.
      // ---------------------------------------------------------
      if (!email) {
        // Extremely rare: session exists but no email in token.
        toast.success("Password changed. Please sign in again.");
        router.replace("/login?changed=1");
        return;
      }

      const signInRes = await signIn("credentials", {
        redirect: false,
        email,
        password: newPassword,
      });

      // Follow your existing pattern: treat `.error` as failure
      if (!signInRes || signInRes.error) {
        // If the silent sign-in failed, send user to login page gracefully
        toast.success("Password changed. Please sign in again.");
        router.replace("/login?changed=1");
        return;
      }

      // ---------------------------------------------------------
      // 3) Success UX
      // ---------------------------------------------------------
      toast.success("Password changed successfully!");
      // Use replace() so back button won't return to /change-password
      router.replace("/dashboard");
    } catch (err) {
      console.error("[ChangePassword] unexpected error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center">
      <h1 className="text-white font-bold text-4xl sm:text-5xl mb-6 text-center">
        Change Password
      </h1>

      <form
        onSubmit={onSubmit}
        className="w-[90%] sm:w-[420px] bg-white rounded-xl shadow-xl p-6 space-y-4"
        noValidate
        aria-busy={loading}
        aria-live="polite"
      >
        {/* Old Password */}
        <div>
          <label htmlFor="oldPassword" className="block text-sm font-semibold text-gray-700">
            Current Password
          </label>
          <div className="relative mt-1">
            <input
              id="oldPassword"
              type={showOld ? "text" : "password"}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 pr-20 focus:outline-none focus:ring focus:ring-blue-200"
              placeholder="Enter your current password"
            />
            <button
              type="button"
              onClick={() => setShowOld((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-600 hover:underline"
              tabIndex={-1}
              aria-label={showOld ? "Hide current password" : "Show current password"}
            >
              {showOld ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-700">
            New Password
          </label>
          <div className="relative mt-1">
            <input
              id="newPassword"
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={`block w-full rounded-md border px-3 py-2 pr-20 focus:outline-none focus:ring
                ${
                  newPassword
                    ? newIsStrong
                      ? "border-green-400 focus:ring-green-200"
                      : "border-red-400 focus:ring-red-200"
                    : "border-gray-300 focus:ring-blue-200"
                }`}
              placeholder="Create a strong new password"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-600 hover:underline"
              tabIndex={-1}
              aria-label={showNew ? "Hide new password" : "Show new password"}
            >
              {showNew ? "Hide" : "Show"}
            </button>
          </div>
          <p
            className={`mt-1 text-xs ${
              newPassword ? (newIsStrong ? "text-green-600" : "text-red-600") : "text-gray-500"
            }`}
          >
            {newPassword
              ? newIsStrong
                ? "✔ Strong password."
                : "✖ Must be 8+ chars and include uppercase, lowercase, number, and special character."
              : "Use at least 8 characters, including uppercase, lowercase, number, and special character."}
          </p>
        </div>

        {/* Confirm New Password */}
        <div>
          <label htmlFor="confirmNewPassword" className="block text-sm font-semibold text-gray-700">
            Confirm New Password
          </label>
          <input
            id="confirmNewPassword"
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            className={`mt-1 block w-full rounded-md border px-3 py-2 focus:outline-none focus:ring
              ${
                confirmNewPassword
                  ? confirmNewPassword === newPassword
                    ? "border-green-400 focus:ring-green-200"
                    : "border-red-400 focus:ring-red-200"
                  : "border-gray-300 focus:ring-blue-200"
              }`}
            placeholder="Re-enter the new password"
          />
          {confirmNewPassword && confirmNewPassword !== newPassword && (
            <p className="mt-1 text-xs text-red-600">New passwords do not match.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full py-2 rounded-md text-white font-semibold shadow
            ${
              canSubmit
                ? "bg-blue-600 hover:bg-blue-500 cursor-pointer"
                : "bg-blue-300 cursor-not-allowed"
            }`}
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </section>
  );
}

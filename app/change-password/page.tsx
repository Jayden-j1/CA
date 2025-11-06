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
// 🔧 What changed (surgical & robust):
// 1) After a successful password update we call `signIn("credentials")` with the NEW password.
// 2) We then force-refresh the NextAuth session cookie by GET /api/auth/session?update=1
//    (no-store) so middleware reads the new JWT on the next navigation.
// 3) We navigate via router.replace('/dashboard') and immediately call router.refresh().
// 4) We add a tiny async tick + a hard redirect fallback (window.location.assign('/dashboard'))
//    to cover edge cases where SPA state lags behind cookie writes in some browsers.
//
// 💡 If your API route lives at /api/auth/change-password, just flip CHANGE_PW_PATH.
//    No other logic is altered.

"use client";

import { useState, useMemo, FormEvent } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { isStrongPassword } from "@/lib/validator";

const CHANGE_PW_PATH = "/api/change-password"; // change to "/api/auth/change-password" if your API lives there

export default function ChangePasswordPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // Email from the current session; used for silent re-login
  const email = session?.user?.email || "";

  // Local state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [loading, setLoading] = useState(false);

  // Validate complexity live (server still re-validates)
  const newIsStrong = useMemo(() => isStrongPassword(newPassword), [newPassword]);

  const canSubmit =
    !loading &&
    !!oldPassword &&
    !!newPassword &&
    !!confirmNewPassword &&
    newPassword === confirmNewPassword &&
    newIsStrong;

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
      // 1) Change password on the server
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
      // 2) Silent re-login with the NEW password to refresh JWT
      //    (so middleware no longer sees mustChangePassword=true)
      // ---------------------------------------------------------
      if (!email) {
        // Extremely rare: session present but no email in token
        toast.success("Password changed. Please sign in again.");
        router.replace("/login?changed=1");
        return;
      }

      const signInRes = await signIn("credentials", {
        redirect: false,
        email,
        password: newPassword,
      });

      if (!signInRes || signInRes.error) {
        // If we couldn't silently re-login, guide the user explicitly
        toast.success("Password changed. Please sign in again.");
        router.replace("/login?changed=1");
        return;
      }

      // ---------------------------------------------------------
      // 3) Force the browser/session to pick up the new cookie
      //    This prevents the middleware from trapping the user
      //    on /change-password due to a stale JWT.
      // ---------------------------------------------------------
      await fetch("/api/auth/session?update=1", { cache: "no-store" });

      // A tiny async tick helps ensure cookie write -> nav ordering
      await new Promise((r) => setTimeout(r, 30));

      toast.success("Password changed successfully!");

      // 4) Navigate to dashboard and refresh client-side cache
      router.replace("/dashboard");
      router.refresh();

      // 5) Hard-redirect fallback (covers rare SPA staleness)
      setTimeout(() => {
        if (typeof window !== "undefined" && window.location.pathname.includes("change-password")) {
          window.location.assign("/dashboard");
        }
      }, 400);
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

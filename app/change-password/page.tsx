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

"use client";

import { useState, useMemo, FormEvent } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { isStrongPassword } from "@/lib/validator";

export default function ChangePasswordPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const email = session?.user?.email || "";

  // Local state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [loading, setLoading] = useState(false);

  // Validate complexity live
  const newIsStrong = useMemo(() => isStrongPassword(newPassword), [newPassword]);
  const canSubmit =
    !loading &&
    !!oldPassword &&
    !!newPassword &&
    !!confirmNewPassword &&
    newPassword === confirmNewPassword &&
    newIsStrong;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    try {
      // 1) Call API to change password
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ oldPassword, newPassword, confirmNewPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error || "Password change failed");
        return;
      }

      // 2) Re-sign in with the new password to refresh the JWT cookie so
      //    middleware sees mustChangePassword=false on the next navigation.
      if (email) {
        const signInRes = await signIn("credentials", {
          redirect: false,
          email,
          password: newPassword,
        });

        if (!signInRes?.ok) {
          // If for some reason re-login fails, fallback to login page.
          toast.error("Password changed, please sign in again.");
          router.push("/login");
          return;
        }
      }

      toast.success("Password changed successfully!");
      router.push("/dashboard");
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
              className="block w-full rounded-md border border-gray-300 px-3 py-2 pr-20 focus:outline-none focus:ring focus:ring-blue-200"
              placeholder="Enter your current password"
            />
            <button
              type="button"
              onClick={() => setShowOld((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-600 hover:underline"
              tabIndex={-1}
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

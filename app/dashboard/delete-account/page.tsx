// app/dashboard/delete-account/page.tsx
//
// Purpose:
// - Simple, focused page that allows the logged-in user to delete (deactivate) their own account.
// - Uses a password input + explicit confirmation text + final confirmation modal.
// - Keeps UI consistent with other forms (white card, rounded, Tailwind utilities).
//
// Notes:
// - This page does NOT handle any auth/session logic directly; it relies on:
//     • useSession + middleware to ensure only logged-in users reach dashboard routes.
//     • The API route /api/account/delete to actually perform the deletion.
// - After successful deletion, we redirect the user to /logout so the session is cleared.

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function DeleteAccountPage() {
  const router = useRouter();

  // We still use session here mainly to ensure we have a user;
  // if there is no session, we could redirect, but we keep it simple
  // and let middleware/route protection handle that globally.
  const { data: session } = useSession();

  // Form state: password input (required to confirm identity)
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Confirmation input: user must type DELETE to proceed.
  const [confirmText, setConfirmText] = useState("");

  // UI state: loading and error feedback.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state: controls the “Are you sure?” pop-up visibility.
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Helper: form is only valid when:
  // - password is non-empty
  // - confirmText strictly equals "DELETE"
  const isFormValid = password.trim().length > 0 && confirmText === "DELETE";

  // Handle main form submit: instead of deleting immediately, we open a confirmation modal.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isFormValid) {
      // Basic safety; button should already be disabled, but we guard anyway.
      setError(
        "Please enter your password and type DELETE in the confirmation field."
      );
      return;
    }

    // Open the "Are you sure?" modal. Actual deletion happens if user clicks Confirm.
    setIsConfirmModalOpen(true);
  };

  // Actual deletion handler, triggered by clicking the green Confirm button in the modal.
  const handleConfirmDeletion = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // We only send the password; the server derives the user from the session.
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message =
          data?.error ||
          "We were unable to delete your account. Please check your password and try again.";
        setError(message);
        setIsSubmitting(false);
        setIsConfirmModalOpen(false);
        return;
      }

      // On success, we close the modal and send the user to the logout flow.
      setIsConfirmModalOpen(false);

      // Redirect to the existing logout page so the current session is cleaned up.
      router.push("/logout");
    } catch (err) {
      console.error("[DeleteAccount] unexpected error", err);
      setError("Something went wrong while deleting your account.");
      setIsSubmitting(false);
      setIsConfirmModalOpen(false);
    }
  };

  // If for some reason session is missing, we can render a simple message.
  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-blue-950 to-blue-900 p-4">
        <div className="bg-white rounded-xl shadow p-6 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold mb-2">Not signed in</h1>
          <p className="text-sm text-gray-700">
            Please log in to manage your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-blue-950 to-blue-900 p-4">
      {/* Main card container, similar style to your other forms (e.g., contact form) */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl bg-white rounded-xl shadow p-6 sm:p-8 space-y-5"
      >
        {/* Heading and context */}
        <header>
          <h1 className="text-2xl font-bold text-blue-900">
            Delete your account
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            This will deactivate your account and remove your access. This
            action cannot be easily undone.
          </p>
        </header>

        {/* Password input with Show/Hide toggle */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium mb-1 text-gray-800"
          >
            Confirm your password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="w-full border rounded px-3 py-2 pr-20 focus:outline-none focus:ring focus:ring-blue-200 text-gray-900"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {/* Show/Hide toggle button positioned inside the input field */}
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-2 px-2 text-xs font-semibold text-blue-700 hover:text-blue-900 focus:outline-none"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-600">
            For your security, please enter your current password.
          </p>
        </div>

        {/* Confirmation text input (type DELETE) */}
        <div>
          <label
            htmlFor="confirmText"
            className="block text-sm font-medium mb-1 text-gray-800"
          >
            Type <span className="font-semibold text-red-600">DELETE</span> to
            confirm
          </label>
          <input
            id="confirmText"
            name="confirmText"
            type="text"
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200 text-gray-900"
            placeholder="Type DELETE to confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.trim())}
          />
          <p className="mt-1 text-xs text-gray-600">
            This helps prevent accidental account deletion.
          </p>
        </div>

        {/* Error message area */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        {/* Main Delete button (red, destructive) */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className={`w-full font-semibold py-2.5 rounded transition-colors ${
              isFormValid && !isSubmitting
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "bg-red-300 text-white cursor-not-allowed"
            }`}
          >
            {isSubmitting ? "Deleting..." : "Delete my account"}
          </button>
        </div>
      </form>

      {/* Confirmation Modal (Yes/No) */}
      {isConfirmModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-confirm-title"
        >
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 mx-4">
            <h2
              id="delete-account-confirm-title"
              className="text-lg font-semibold mb-3 text-gray-900"
            >
              Are you absolutely sure?
            </h2>
            <p className="text-sm text-gray-700 mb-5">
              This will deactivate your account and remove your access. You may
              lose access to any associated content and history.
            </p>
            <div className="flex justify-end gap-3">
              {/* Red Cancel button */}
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white text-sm font-semibold"
              >
                Cancel
              </button>
              {/* Green Confirm button */}
              <button
                type="button"
                onClick={handleConfirmDeletion}
                disabled={isSubmitting}
                className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Deleting..." : "Yes, delete my account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

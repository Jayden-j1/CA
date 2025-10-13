// lib/toastMessages.ts
//
// Purpose:
// - Centralize toast messaging (success, role-specific errors, invalid-credential hint, and system errors).
// - Keep messages consistent and non-technical for end users.
// - Single place to adjust copy/branding later.
//
// Notes:
// - This adds `showInvalidCredentialsToast()` which your LoginForm imports.
// - All existing exports (showRoleToast, showRoleErrorToast, showSystemErrorToast) are preserved.

import toast from "react-hot-toast";

// ------------------------------
// Success toast by role (unchanged)
// ------------------------------
export function showRoleToast(role: string) {
  switch (role) {
    case "ADMIN":
      toast.success("👑 Welcome back, Admin!", {
        style: { background: "#7e22ce", color: "#fff" }, // purple
        duration: 2000,
      });
      break;
    case "BUSINESS_OWNER":
      toast.success("🏢 Welcome Business Owner! Dashboard is ready.", {
        style: { background: "#0d9488", color: "#fff" }, // teal
        duration: 2000,
      });
      break;
    default:
      toast.success("🎉 Welcome aboard! Glad to have you here.", {
        style: { background: "#16a34a", color: "#fff" }, // green
        duration: 2000,
      });
      break;
  }
}

// ------------------------------
// Error toast by role (unchanged)
// ------------------------------
export function showRoleErrorToast(role: string) {
  switch (role) {
    case "ADMIN":
      toast.error("❌ Admin login failed. Please try again.", {
        style: { background: "#7e22ce", color: "#fff" }, // purple
        duration: 2000,
      });
      break;
    case "BUSINESS_OWNER":
      toast.error("❌ Business Owner login failed. Please try again.", {
        style: { background: "#0d9488", color: "#fff" }, // teal
        duration: 2000,
      });
      break;
    default:
      toast.error("❌ Login failed. Please check your details.", {
        style: { background: "#16a34a", color: "#fff" }, // green
        duration: 2000,
      });
      break;
  }
}

// ------------------------------
// New: Friendly invalid-credentials message
// ------------------------------
// Use this when the email doesn't match an account OR the password is wrong.
// (Security-aware: avoids confirming whether the email exists.)
export function showInvalidCredentialsToast() {
  toast.error(
    "We couldn’t find an account with that email or the password is incorrect.",
    {
      style: { background: "#334155", color: "#fff" }, // slate
      duration: 3000,
    }
  );
}

// ------------------------------
// System-level error (unchanged)
// ------------------------------
// Use this for unexpected server/network/runtime errors.
export function showSystemErrorToast() {
  toast.error("⚠️ A system error occurred. Please try again later.", {
    style: { background: "#6b21a8", color: "#fff" }, // deep purple
    duration: 2000,
  });
}

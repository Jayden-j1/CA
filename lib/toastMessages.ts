// lib/toastMessages.ts
//
// Purpose:
// - Centralize role-based toast logic (success, error, and system-level errors).
// - Keeps forms clean and ensures consistent toast styles across the app.

import toast from "react-hot-toast";

// ------------------------------
// Success toast by role
// ------------------------------
export function showRoleToast(role: string) {
  switch (role) {
    case "ADMIN":
      toast.success("👑 Welcome back, Admin!", {
        style: { background: "#7e22ce", color: "#fff" }, // purple
        duration: 3000,
      });
      break;
    case "BUSINESS_OWNER":
      toast.success("🏢 Welcome Business Owner! Dashboard is ready.", {
        style: { background: "#0d9488", color: "#fff" }, // teal
        duration: 3000,
      });
      break;
    default:
      toast.success("🎉 Welcome aboard! Glad to have you here.", {
        style: { background: "#16a34a", color: "#fff" }, // green
        duration: 3000,
      });
      break;
  }
}

// ------------------------------
// Error toast by role
// ------------------------------
export function showRoleErrorToast(role: string) {
  switch (role) {
    case "ADMIN":
      toast.error("❌ Admin login failed. Please try again.", {
        style: { background: "#7e22ce", color: "#fff" }, // purple
        duration: 3000,
      });
      break;
    case "BUSINESS_OWNER":
      toast.error("❌ Business Owner login failed. Please try again.", {
        style: { background: "#0d9488", color: "#fff" }, // teal
        duration: 3000,
      });
      break;
    default:
      toast.error("❌ Login failed. Please check your details.", {
        style: { background: "#16a34a", color: "#fff" }, // green
        duration: 3000,
      });
      break;
  }
}

// ------------------------------
// Default system-level error
// ------------------------------
// Used when something unexpected happens (server error, network error, etc.)
export function showSystemErrorToast() {
  toast.error("⚠️ A system error occurred. Please try again later.", {
    style: { background: "#6b21a8", color: "#fff" }, // deep purple
    duration: 3000,
  });
}










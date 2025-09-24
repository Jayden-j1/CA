// lib/toastMessages.ts
//
// Purpose:
// - Centralized toast helpers for SUCCESS and ERROR messages.
// - Ensures consistent role-aware messages and styles across the app.
// - Toasts stay visible for 6 seconds (long enough during redirects).
//
// ✅ Success toasts → personalized by role (Admin, Business Owner, User).
// ✅ Error toasts → also personalized by role, different styling per role.
// ✅ No need to repeat toast logic in every form — import these helpers instead.

import toast from "react-hot-toast";

// ----------------------------
// Success toast (login/signup success)
// ----------------------------
export function showRoleToast(role?: string) {
  switch (role) {
    case "ADMIN":
      toast.success("👑 Welcome Admin! You have full control.", {
        duration: 6000,
        style: {
          background: "#7e22ce", // Tailwind purple-700
          color: "#fff",
          fontWeight: "600",
        },
      });
      break;

    case "BUSINESS_OWNER":
      toast.success("📊 Welcome Business Owner! Your dashboard is ready.", {
        duration: 6000,
        style: {
          background: "#0d9488", // Tailwind teal-600
          color: "#fff",
          fontWeight: "600",
        },
      });
      break;

    case "USER":
    default:
      toast.success("🎉 Welcome aboard! Glad to have you here.", {
        duration: 6000,
        style: {
          background: "#16a34a", // Tailwind green-600
          color: "#fff",
          fontWeight: "600",
        },
      });
      break;
  }
}

// ----------------------------
// Error toast (failed login/signup)
// ----------------------------
export function showRoleErrorToast(role?: string) {
  switch (role) {
    case "ADMIN":
      toast.error("⚠️ Admin login failed. Double-check your credentials.", {
        duration: 6000,
        style: {
          background: "#6b21a8", // Tailwind purple-800 (darker error tone)
          color: "#fff",
          fontWeight: "600",
        },
      });
      break;

    case "BUSINESS_OWNER":
      toast.error("⚠️ Business Owner login failed. Please try again.", {
        duration: 6000,
        style: {
          background: "#155e75", // Tailwind teal-800 (darker error tone)
          color: "#fff",
          fontWeight: "600",
        },
      });
      break;

    case "USER":
    default:
      toast.error("⚠️ Login failed. Please check your email or password.", {
        duration: 6000,
        style: {
          background: "#991b1b", // Tailwind red-800
          color: "#fff",
          fontWeight: "600",
        },
      });
      break;
  }
}









// // lib/toastMessages.ts
// //
// // Purpose:
// // - Provide role-aware messages + colors for toasts.
// // - Keeps signup + login flows consistent.
// // - Includes a fallback toast for unknown/new roles (gray).
// //
// // Usage:
// //   showRoleToast("ADMIN")
// //   showRoleToast("BUSINESS_OWNER")
// //   showRoleToast("USER")
// //   showRoleToast("NEW_ROLE") → falls back safely

// import toast from "react-hot-toast";

// // Type for role
// export type Role = "USER" | "BUSINESS_OWNER" | "ADMIN" | string | undefined;

// // ✅ Map roles → message + style
// const roleConfig: Record<string, { message: string; style: any }> = {
//   ADMIN: {
//     message: "👑 Welcome Admin! You have full system access.",
//     style: { background: "#7e22ce", color: "#fff" }, // purple
//   },
//   BUSINESS_OWNER: {
//     message: "🏢 Welcome Business Owner! Manage your staff and dashboard here.",
//     style: { background: "#0d9488", color: "#fff" }, // teal
//   },
//   USER: {
//     message: "🎉 Welcome aboard! Glad to have you here.",
//     style: { background: "#16a34a", color: "#fff" }, // green
//   },
// };

// // ✅ Fallback config (used for unknown roles)
// const fallbackConfig = {
//   message: "👋 Welcome! Your account is ready.",
//   style: { background: "#4b5563", color: "#fff" }, // neutral gray
// };

// // ✅ Function: show role-aware toast with fallback
// export function showRoleToast(role: Role) {
//   const config = role ? roleConfig[role] || fallbackConfig : fallbackConfig;

//   toast.success(config.message, {
//     style: {
//       borderRadius: "12px",
//       padding: "12px 16px",
//       fontWeight: "600",
//       ...config.style, // merge role-specific style
//     },
//     iconTheme: {
//       primary: "#fff",
//       secondary: config.style.background,
//     },
//   });
// }

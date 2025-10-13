'use client';

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

// -------------------------------------------------------
// LogoutToast (Client-only)
// -------------------------------------------------------
// Purpose:
// - Detects ?logout=success and shows a toast.
// - Uses null-safe searchParams to prevent type errors.
// - Cleans URL after toast to prevent re-trigger.
// -------------------------------------------------------
export default function LogoutToast() {
  const params = useSearchParams();

  useEffect(() => {
    // ✅ Null-safe query param access
    const logoutFlag = (params?.get("logout") ?? "");
    if (logoutFlag === "success") {
      toast.success("You’ve been logged out successfully.", {
        duration: 2000,
      });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [params]);

  return null;
}

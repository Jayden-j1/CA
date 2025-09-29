'use client';

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

// -------------------------------------------------------
// LogoutToast
// -------------------------------------------------------
// Purpose:
// - Detect "?logout=success" in the URL query string.
// - Show a success toast if present.
// - Runs only on the client (avoids SSR issues).
// -------------------------------------------------------
export default function LogoutToast() {
  const params = useSearchParams();

  useEffect(() => {
    const logoutFlag = params.get("logout");
    if (logoutFlag === "success") {
      toast.success("You’ve been logged out successfully.", {
        duration: 2000,
      });

      // Optional: clean the query string so users can refresh without retriggering
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [params]);

  return null; // nothing rendered, just side effect
}

// hooks/usePaidAccess.ts
//
// Purpose
// -------
// Fast, reliable client-side check to determine whether the current user
// should see paid content (Map/Course/Billing).
//
// Why?
// - The Stripe webhook flips user.hasPaid quickly, but the NextAuth session
//   may not reflect it immediately. This hook mirrors your Navbar’s fix:
//   call /api/payments/check (authoritative server truth) and briefly poll
//   if the page was loaded with ?success=true.
//
// Behavior
// - Returns { loading, hasAccess, inheritedFrom, healed }.
// - Polls up to ~9s when `success=true` is present in the URL.
// - Single-shot probe otherwise.
//
// Pillars
// - Efficiency: tiny fetches, short-lived polling only on success.
// - Robustness: authoritative server truth, independent of session lag.
// - Simplicity: one hook; same logic for Billing/Map/Course.
// - Security: read-only API; no client-side mutations.

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export interface PaidAccessResult {
  loading: boolean;
  hasAccess: boolean;
  inheritedFrom?: "business";
  healed?: boolean;
  raw?: any;
}

export function usePaidAccess(): PaidAccessResult {
  const [state, setState] = useState<PaidAccessResult>({
    loading: true,
    hasAccess: false,
  });

  const searchParams = useSearchParams();
  const justSucceeded = (searchParams?.get("success") ?? "") === "true";

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const maxAttempts = justSucceeded ? 6 : 1; // ~9s window @1.5s each
    const intervalMs = 1500;
    let attempts = 0;

    const probe = async () => {
      try {
        const res = await fetch("/api/payments/check", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;

        const ok = res.ok && Boolean(data?.hasAccess === true);
        setState({
          loading: false,
          hasAccess: ok,
          inheritedFrom: ok && data?.inheritedFrom === "business" ? "business" : undefined,
          healed: ok && data?.healed ? true : undefined,
          raw: data,
        });

        attempts += 1;
        if (!ok && attempts < maxAttempts) {
          timer = setTimeout(probe, intervalMs);
        }
      } catch {
        if (cancelled) return;
        attempts += 1;
        if (attempts < maxAttempts) {
          timer = setTimeout(probe, intervalMs);
        } else {
          setState((s) => ({ ...s, loading: false }));
        }
      }
    };

    probe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [justSucceeded]);

  return state;
}

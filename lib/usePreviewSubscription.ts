// lib/usePreviewSubscription.ts
//
// Purpose
// -------
// Lightweight hook for real-time Sanity preview. It fetches initial data, then
// listens for any content updates and re-fetches fresh content. This avoids
// relying on `.result` on the listen event (which is not always present).
//
// Why this version?
// -----------------
// - Fixes TS error: "Property 'result' does not exist on type 'ListenEvent'"
//   by simply re-fetching on any update event instead of depending on event.result.
// - Keeps implementation simple, robust, and type-safe.

"use client";

import { useEffect, useState } from "react";
import { sanityPreviewClient } from "@/lib/sanity.preview";

export function usePreviewSubscription<T = any>(query: string, params: Record<string, any> = {}) {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    const fetchAndSet = async () => {
      try {
        const next = await sanityPreviewClient.fetch<T>(query, params);
        if (!cancelled) setData(next);
      } catch (err) {
        // Non-fatal: preview should never crash the UI
        console.error("[Sanity preview] fetch error:", err);
      }
    };

    const run = async () => {
      // 1) Initial fetch
      await fetchAndSet();

      // 2) Subscribe to updates; on any event, refetch fresh data
      try {
        subscription = sanityPreviewClient
          .listen(query, params, { visibility: "query" })
          .subscribe(() => {
            // Re-fetch on mutation/welcome/reconnect
            fetchAndSet();
          });
      } catch (err) {
        console.error("[Sanity preview] listen error:", err);
      }
    };

    run();

    return () => {
      cancelled = true;
      if (subscription) subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, JSON.stringify(params)]);

  return data;
}

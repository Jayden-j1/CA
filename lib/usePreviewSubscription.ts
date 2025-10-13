"use client";
import { useEffect, useState } from "react";
import { sanityPreviewClient } from "./sanity.preview";

// Live preview subscription hook
export function usePreviewSubscription<T = any>(
  query: string,
  params: Record<string, any> = {}
) {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    async function fetchAndSet() {
      try {
        const result = await sanityPreviewClient.fetch<T>(query, params);
        if (!cancelled) setData(result);
      } catch (e) {
        console.error("[Sanity] preview fetch error:", e);
      }
    }

    fetchAndSet();

    try {
      subscription = sanityPreviewClient
        .listen(query, params, { visibility: "query" })
        .subscribe(() => fetchAndSet());
    } catch (err) {
      console.error("[Sanity] listen error:", err);
    }

    return () => {
      cancelled = true;
      if (subscription) subscription.unsubscribe();
    };
  }, [query, JSON.stringify(params)]);

  return data;
}

// lib/access.ts
//
// Purpose
// -------
// Server-side helper for RSC pages/layouts to read the *authoritative*
// paid-access signal through your existing /api/payments/check endpoint.
//
// What’s fixed in this version?
// -----------------------------
// • ✅ In some Next setups, `headers()` and `cookies()` are typed as Promise<…>.
//      We now `await` both before calling .get() / .getAll().
// • ✅ Explicit cookie entry typing, so TS doesn’t infer `any`.
// • ✅ Async cookie serialization helper.
// • Robust base-URL resolution that works locally and in production.
//
// Pillars
// -------
// - Efficiency  : one no-store fetch; minimal header forwarding
// - Robustness  : safe env/header resolution; defensive parsing
// - Simplicity  : small helper; rich comments
// - Security    : forwards only what’s needed (Cookie + optional Authorization)

import { cookies, headers } from "next/headers";

type AccessResult = {
  hasAccess: boolean;
  inheritedFrom?: "business";
  healed?: boolean;
};

/**
 * Resolve absolute base URL for server-side fetches.
 * Priority:
 *  1) NEXT_PUBLIC_APP_URL (recommended)
 *  2) x-forwarded-proto + x-forwarded-host (proxy-friendly)
 *  3) host header + https (fallback)
 */
function resolveBaseUrl(hdrs: Readonly<Headers>): string {
  const envBase = process.env.NEXT_PUBLIC_APP_URL;
  if (envBase && envBase.startsWith("http")) return envBase.replace(/\/+$/, "");

  const proto =
    hdrs.get("x-forwarded-proto") ||
    hdrs.get("x-forwarded-protocol") ||
    "https";

  const host =
    hdrs.get("x-forwarded-host") ||
    hdrs.get("host") ||
    process.env.NEXT_PUBLIC_APP_HOST ||
    "";

  if (host) return `${proto}://${host}`.replace(/\/+$/, "");

  return "";
}

/**
 * Serialize all cookies into a single Cookie header.
 * In your environment, cookies() may be Promise-like → await it.
 */
async function serializeCookieHeader(): Promise<string> {
  const store = await cookies();
  // The items returned by getAll() at minimum have { name: string; value: string }
  const all = store.getAll() as Array<{ name: string; value: string }>;

  const parts = all.map((c: { name: string; value: string }) => {
    const name = encodeURIComponent(c.name);
    const value = encodeURIComponent(c.value);
    return `${name}=${value}`;
    // NOTE: Cookie header pairs do not include attributes here (Path, HttpOnly, etc.)
  });

  return parts.join("; ");
}

/**
 * getPaidAccessServer
 * -------------------
 * Server-side probe that calls /api/payments/check with the caller’s cookies
 * (and Authorization header, if present) so the API evaluates the same user context.
 */
export async function getPaidAccessServer(): Promise<AccessResult> {
  try {
    // In some Next versions, headers() returns a Promise<ReadonlyHeaders>
    const hdrs = await headers();

    const base = resolveBaseUrl(hdrs);
    if (!base) {
      // If we cannot resolve a base URL, fail safely.
      return { hasAccess: false };
    }

    const cookieHeader = await serializeCookieHeader();
    const authHeader = hdrs.get("authorization") || undefined;

    const res = await fetch(`${base}/api/payments/check`, {
      method: "GET",
      cache: "no-store",
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(authHeader ? { authorization: authHeader } : {}),
        accept: "application/json",
      },
    }).catch(() => null);

    if (!res) return { hasAccess: false };

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      return { hasAccess: false };
    }

    return {
      hasAccess: Boolean(data?.hasAccess === true),
      inheritedFrom: data?.inheritedFrom === "business" ? "business" : undefined,
      healed: data?.healed ? true : undefined,
    };
  } catch {
    return { hasAccess: false };
  }
}

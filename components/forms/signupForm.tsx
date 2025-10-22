'use client';

/**
 * components/forms/SignupForm.tsx
 *
 * Purpose
 * -------
 * A self-contained signup form that:
 *  1) Creates an account via /api/auth/signup
 *  2) Silently signs the user in (NextAuth credentials, no redirect)
 *  3) Optionally creates a Stripe Checkout Session (depending on origin/props)
 *  4) Redirects either to Stripe (checkout flow) or Dashboard
 *
 * Hydration fix
 * -------------
 * ❌ Old approach used `window.location.pathname` to detect /signup.
 *    That produced different server vs client markup → hydration mismatch.
 * ✅ New approach accepts a *server-decided* `origin` prop:
 *    - origin === 'signup'   → dashboard after signup (no Stripe)
 *    - origin === 'services' → go to Stripe Checkout
 *
 * Pillars
 * -------
 * ✅ Efficiency  – no extra roundtrips; minimal branching
 * ✅ Robustness  – server-decided branch => deterministic SSR markup
 * ✅ Simplicity  – one prop controls all text/redirect behavior
 * ✅ Ease of mgmt – no need to sprinkle `typeof window` checks
 * ✅ Security    – server endpoints still validate data
 */

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';

/** Stripe package choices your project supports */
export type PackageType = 'individual' | 'business' | 'staff_seat';

/**
 * Where this form is being rendered from.
 * - 'signup'   → dashboard after signup (never Stripe here)
 * - 'services' → Stripe checkout after signup (uses selectedPackage)
 */
export type SignupOrigin = 'signup' | 'services';

/**
 * Props:
 * - origin:             server-driven source of the form (prevents hydration mismatches)
 * - redirectTo:         where to go when not doing checkout (e.g. '/dashboard')
 * - postSignupBehavior: if provided, used when origin='services'. Ignored on origin='signup'
 * - selectedPackage:    package to purchase in checkout (services flow)
 */
export interface SignupFormProps {
  origin: SignupOrigin;
  redirectTo?: string;
  postSignupBehavior?: 'checkout' | 'dashboard';
  selectedPackage?: PackageType;
}

/** Internal type for the form’s “account type” radio control */
type UserType = 'individual' | 'business';

export default function SignupForm({
  origin,
  redirectTo = '/dashboard',
  postSignupBehavior = 'checkout', // default behavior for non-signup pages
  selectedPackage = 'individual',
}: SignupFormProps) {
  // --------------------------
  // Form state
  // --------------------------
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState<UserType>('individual');
  const [businessName, setBusinessName] = useState('');

  // --------------------------
  // UX state
  // --------------------------
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --------------------------
  // Helpers
  // --------------------------

  /**
   * Decide which package we’ll actually purchase.
   * Business accounts must use the "business" package regardless of the query param.
   * Individuals follow whatever was passed from /signup?package=… (default to "individual").
   */
  const normalizePackage = (): PackageType => {
    if (userType === 'business') return 'business';
    const allowed: PackageType[] = ['individual', 'business', 'staff_seat'];
    return allowed.includes(selectedPackage) ? selectedPackage : 'individual';
  };

  /** Parse a helpful message from a Response safely */
  const safeMessage = async (res: Response): Promise<string | null> => {
    try {
      const data = await res.json();
      return data?.error || data?.message || null;
    } catch {
      return res.statusText || null;
    }
  };

  // --------------------------
  // Submit handler
  // --------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      // 1) Create the user account
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          userType, // 'individual' | 'business' → API maps to role & packageType
          businessName: userType === 'business' ? businessName : undefined,
        }),
      });

      if (!signupRes.ok) {
        const msg = await safeMessage(signupRes);
        throw new Error(msg || 'Failed to create account');
      }

      // 2) Silent sign-in (so session exists for Stripe metadata.userId, gating, etc.)
      const signInRes = await signIn('credentials', {
        email,
        password,
        redirect: false, // we control the redirect below
      });

      if (!signInRes || signInRes.error) {
        throw new Error(
          signInRes?.error || 'Account created, but login failed. Please log in and try again.'
        );
      }

      // 3) Routing logic (server-driven by `origin`):
      // • origin === 'signup'   → ALWAYS go to dashboard (no Stripe)
      // • origin === 'services' → Respect `postSignupBehavior` (default 'checkout')
      if (origin === 'signup') {
        window.location.href = redirectTo; // usually "/dashboard"
        return;
      }

      // services flow
      if (postSignupBehavior === 'checkout') {
        const packageType = normalizePackage();

        const checkoutRes = await fetch('/api/checkout/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packageType }),
        });

        if (!checkoutRes.ok) {
          const msg = await safeMessage(checkoutRes);
          console.error('[SignupForm] Checkout session creation failed:', msg);
          window.location.href = '/dashboard/upgrade';
          return;
        }

        const { url } = (await checkoutRes.json()) as { url?: string };
        if (url) {
          window.location.href = url; // Hard redirect to Stripe
          return;
        }

        console.error('[SignupForm] Missing Stripe checkout URL in response');
        window.location.href = '/dashboard/upgrade';
        return;
      }

      // 4) Alternate path: go straight to dashboard
      window.location.href = redirectTo;
    } catch (err: any) {
      console.error('[SignupForm] Error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  // --------------------------
  // Render (SSR-stable: no window checks)
  // --------------------------
  const isSignupOrigin = origin === 'signup';

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-xl bg-white rounded-xl shadow p-6 space-y-4"
      aria-busy={loading}
      aria-live="polite"
      noValidate
    >
      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="bg-red-50 text-red-700 border border-red-200 rounded p-3 text-sm"
        >
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Full name
        </label>
        <input
          id="name"
          type="text"
          className="w-full border rounded px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          autoComplete="name"
          required
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="w-full border rounded px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@example.com"
          autoComplete="email"
          required
        />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="w-full border rounded px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <p className="text-xs text-gray-500 mt-1">
          Must be at least 8 characters and include uppercase, lowercase, number, and special.
        </p>
      </div>

      {/* Account type */}
      <fieldset>
        <legend className="block text-sm font-medium mb-2">Account type</legend>
        <div className="flex items-center gap-6">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="userType"
              value="individual"
              checked={userType === 'individual'}
              onChange={() => setUserType('individual')}
            />
            <span>Individual</span>
          </label>

          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="userType"
              value="business"
              checked={userType === 'business'}
              onChange={() => setUserType('business')}
            />
            <span>Business</span>
          </label>
        </div>
      </fieldset>

      {/* Business name (only when account type is business) */}
      {userType === 'business' && (
        <div>
          <label htmlFor="businessName" className="block text-sm font-medium mb-1">
            Business name
          </label>
          <input
            id="businessName"
            type="text"
            className="w-full border rounded px-3 py-2"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Acme Pty Ltd"
            required
          />
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded"
      >
        {loading ? 'Creating account…' : 'Create account'}
      </button>

      {/* Tiny footnote for clarity (SSR-stable) */}
      <p className="text-xs text-gray-500 text-center">
        {isSignupOrigin ? (
          <>After signup you’ll land on your dashboard (you can upgrade any time).</>
        ) : (
          <>
            After signup you’ll be taken to checkout for: <strong>{normalizePackage()}</strong>
          </>
        )}
      </p>
    </form>
  );
}

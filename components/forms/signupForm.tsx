"use client";

/**
 * components/forms/SignupForm.tsx
 *
 * Purpose
 * -------
 * Self-contained signup form that ensures the correct branching:
 *  1) Creates account via /api/auth/signup
 *  2) Silently signs in (NextAuth) so we have a session
 *  3) If origin === 'services' → create Stripe checkout and redirect to Stripe
 *     else → go straight to /dashboard
 *
 * Security & Robustness Enhancements (no flow changes)
 * ----------------------------------------------------
 * • Normalize email (trim + lowercase) before sending to /api/auth/signup
 *   and next-auth credentials sign-in.
 * • Trim name/businessName so we don’t send purely-whitespace values.
 * • Add small client-side guards if those trimmed values are empty, with
 *   clear error messages (server still validates as defense-in-depth).
 *
 * Notes
 * -----
 * - DO NOT read window / pathname to decide behavior; server sends `origin`.
 * - Business users always normalize to the "business" package type.
 * - We never trust client price; the server route resolves prices securely.
 */

import React, { useState } from "react";
import { signIn } from "next-auth/react";

export type PackageType = "individual" | "business" | "staff_seat";
export type SignupOrigin = "signup" | "services";

export interface SignupFormProps {
  origin: SignupOrigin; // server-driven: 'signup' | 'services'
  redirectTo?: string; // default: '/dashboard'
  postSignupBehavior?: "checkout" | "dashboard";
  selectedPackage?: PackageType; // used when origin === 'services'
}

// Internal UI radio
type UserType = "individual" | "business";

export default function SignupForm({
  origin,
  redirectTo = "/dashboard",
  postSignupBehavior = "checkout",
  selectedPackage = "individual",
}: SignupFormProps) {
  // --------------------------
  // Form state
  // --------------------------
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // password state
  const [password, setPassword] = useState("");

  // UI state that controls visibility of the password input.
  const [showPassword, setShowPassword] = useState(false);

  const [userType, setUserType] = useState<UserType>("individual");
  const [businessName, setBusinessName] = useState("");

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
   * - Business accounts always purchase the "business" package.
   * - Individuals use selectedPackage (fallback to 'individual').
   */
  const normalizePackage = (): PackageType => {
    if (userType === "business") return "business";
    const allowed: PackageType[] = ["individual", "business", "staff_seat"];
    return allowed.includes(selectedPackage) ? selectedPackage : "individual";
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
      // Normalize core fields before sending them:
      // - trim name and businessName for data cleanliness
      // - trim + lowercase email for case-insensitive identity
      const trimmedName = name.trim();
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedBusinessName = businessName.trim();

      // Simple client-side guards so we don't send junk payloads.
      if (!trimmedName) {
        setError("Please enter your full name.");
        setLoading(false);
        return;
      }
      if (!normalizedEmail) {
        setError("Please enter a valid email address.");
        setLoading(false);
        return;
      }
      if (userType === "business" && !trimmedBusinessName) {
        setError("Please enter your business name.");
        setLoading(false);
        return;
      }

      // 1) Create user
      const signupRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: normalizedEmail,
          password,
          userType, // 'individual' | 'business'
          businessName: userType === "business" ? trimmedBusinessName : undefined,
        }),
      });

      if (!signupRes.ok) {
        const msg = await safeMessage(signupRes);
        throw new Error(msg || "Failed to create account");
      }

      // 2) Silent sign-in (for Stripe metadata.userId and gating)
      const signInRes = await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: false,
      });
      if (!signInRes || signInRes.error) {
        throw new Error(
          signInRes?.error || "Account created, but login failed. Please log in and try again."
        );
      }

      // 3) Branch by origin:
      // ----------------------------------------------------------------
      // A) If this is the "signup" page:
      //    - INDIVIDUAL: go to dashboard (unchanged)
      //    - BUSINESS:   go to checkout (Sign-up → payment → dashboard)
      if (origin === "signup") {
        if (userType === "business") {
          const checkoutRes = await fetch("/api/checkout/create-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ packageType: "business" }),
          });

          if (!checkoutRes.ok) {
            const msg = await safeMessage(checkoutRes);
            console.error("[SignupForm] Checkout session (business@signup) failed:", msg);
            // Land on Upgrade page (still logged in) so the user can retry
            window.location.href = "/dashboard/upgrade?error=checkout";
            return;
          }

          const { url } = (await checkoutRes.json()) as { url?: string };
          if (url) {
            window.location.href = url; // hard redirect to Stripe
            return;
          }

          console.error("[SignupForm] Missing Stripe checkout URL in response");
          window.location.href = "/dashboard/upgrade?error=no_url";
          return;
        }

        // INDIVIDUAL via "signup" origin → unchanged behavior
        window.location.href = redirectTo; // usually "/dashboard"
        return;
      }

      // ----------------------------------------------------------------
      // B) If this is the "services" origin:
      //    Respect postSignupBehavior (default 'checkout') for Individuals.
      if (postSignupBehavior === "checkout") {
        const packageType = normalizePackage();

        const checkoutRes = await fetch("/api/checkout/create-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packageType }),
        });

        if (!checkoutRes.ok) {
          const msg = await safeMessage(checkoutRes);
          console.error("[SignupForm] Checkout session creation failed:", msg);
          // If checkout fails for any reason, land on Upgrade page (still logged in)
          window.location.href = "/dashboard/upgrade?error=checkout";
          return;
        }

        const { url } = (await checkoutRes.json()) as { url?: string };
        if (url) {
          window.location.href = url; // hard redirect to Stripe
          return;
        }

        console.error("[SignupForm] Missing Stripe checkout URL in response");
        window.location.href = "/dashboard/upgrade?error=no_url";
        return;
      }

      // C) Alternate: go straight to dashboard
      window.location.href = redirectTo;
    } catch (err: any) {
      console.error("[SignupForm] Error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  // Tiny handler that toggles password visibility
  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  const isSignupOrigin = origin === "signup";

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

        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            className="w-full border rounded px-3 py-2 pr-20"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
            minLength={8}
          />
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-600 hover:underline focus:outline-none"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

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
              checked={userType === "individual"}
              onChange={() => setUserType("individual")}
            />
            <span>Individual</span>
          </label>

          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="userType"
              value="business"
              checked={userType === "business"}
              onChange={() => setUserType("business")}
            />
            <span>Business</span>
          </label>
        </div>
      </fieldset>

      {/* Business name (only for business) */}
      {userType === "business" && (
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
        {loading ? "Creating account…" : "Create account"}
      </button>

      {/* Footnote (SSR-stable) */}
      <p className="text-xs text-gray-500 text-center">
        {isSignupOrigin ? (
          userType === "business" ? (
            <>
              After signup you’ll be taken to checkout for: <strong>business</strong>.
            </>
          ) : (
            <>After signup you’ll land on your dashboard (you can upgrade any time).</>
          )
        ) : (
          <>
            After signup you’ll be taken to checkout for:{" "}
            <strong>{normalizePackage()}</strong>
          </>
        )}
      </p>
    </form>
  );
}









// 'use client';

// /**
//  * components/forms/SignupForm.tsx
//  *
//  * Purpose
//  * -------
//  * Self-contained signup form that ensures the correct branching:
//  *  1) Creates account via /api/auth/signup
//  *  2) Silently signs in (NextAuth) so we have a session
//  *  3) If origin === 'services' → create Stripe checkout and redirect to Stripe
//  *     else → go straight to /dashboard
//  *
//  * Patch (business flow via Sign-up page)
//  * --------------------------------------
//  * • New: If origin === 'signup' AND the user selects "business", we *do* send them
//  *   straight to checkout after successful sign-up (Sign-up → payment → dashboard),
//  *   matching your requested flow. Individuals remain unchanged.
//  *
//  * Notes
//  * -----
//  * - DO NOT read window / pathname to decide behavior; server sends `origin`.
//  * - Business users always normalize to the "business" package type.
//  * - We never trust client price; the server route resolves prices securely.
//  *
//  * Minimal Change (This PR)
//  * ------------------------
//  * ✅ Add "Show / Hide" toggle for the password field ONLY.
//  *    - Introduces `showPassword` boolean state
//  *    - Adds a small button to toggle the input type between "password" and "text"
//  *    - Adds right padding to the input to make space for the toggle
//  *    - No changes to existing submission, branching, or Stripe logic
//  */

// import React, { useState } from 'react';
// import { signIn } from 'next-auth/react';

// export type PackageType = 'individual' | 'business' | 'staff_seat';
// export type SignupOrigin = 'signup' | 'services';

// export interface SignupFormProps {
//   origin: SignupOrigin;                 // server-driven: 'signup' | 'services'
//   redirectTo?: string;                  // default: '/dashboard'
//   postSignupBehavior?: 'checkout' | 'dashboard';
//   selectedPackage?: PackageType;        // used when origin === 'services'
// }

// // Internal UI radio
// type UserType = 'individual' | 'business';

// export default function SignupForm({
//   origin,
//   redirectTo = '/dashboard',
//   postSignupBehavior = 'checkout',
//   selectedPackage = 'individual',
// }: SignupFormProps) {
//   // --------------------------
//   // Form state
//   // --------------------------
//   const [name, setName] = useState('');
//   const [email, setEmail] = useState('');

//   // NOTE: existing password state stays the same
//   const [password, setPassword] = useState('');

//   // ✅ NEW (minimal): UI state that controls visibility of the password input.
//   //    We keep this local and do not affect submission or any auth logic.
//   const [showPassword, setShowPassword] = useState(false);

//   const [userType, setUserType] = useState<UserType>('individual');
//   const [businessName, setBusinessName] = useState('');

//   // --------------------------
//   // UX state
//   // --------------------------
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   // --------------------------
//   // Helpers
//   // --------------------------

//   /**
//    * Decide which package we’ll actually purchase.
//    * - Business accounts always purchase the "business" package.
//    * - Individuals use selectedPackage (fallback to 'individual').
//    */
//   const normalizePackage = (): PackageType => {
//     if (userType === 'business') return 'business';
//     const allowed: PackageType[] = ['individual', 'business', 'staff_seat'];
//     return allowed.includes(selectedPackage) ? selectedPackage : 'individual';
//   };

//   /** Parse a helpful message from a Response safely */
//   const safeMessage = async (res: Response): Promise<string | null> => {
//     try {
//       const data = await res.json();
//       return data?.error || data?.message || null;
//     } catch {
//       return res.statusText || null;
//     }
//   };

//   // --------------------------
//   // Submit handler
//   // --------------------------
//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (loading) return;

//     setError(null);
//     setLoading(true);

//     try {
//       // 1) Create user
//       const signupRes = await fetch('/api/auth/signup', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           name,
//           email,
//           password,
//           userType, // 'individual' | 'business'
//           businessName: userType === 'business' ? businessName : undefined,
//         }),
//       });

//       if (!signupRes.ok) {
//         const msg = await safeMessage(signupRes);
//         throw new Error(msg || 'Failed to create account');
//       }

//       // 2) Silent sign-in (for Stripe metadata.userId and gating)
//       const signInRes = await signIn('credentials', {
//         email,
//         password,
//         redirect: false,
//       });
//       if (!signInRes || signInRes.error) {
//         throw new Error(
//           signInRes?.error || 'Account created, but login failed. Please log in and try again.'
//         );
//       }

//       // 3) Branch by origin:
//       // ----------------------------------------------------------------
//       // A) If this is the "signup" page:
//       //    - INDIVIDUAL: go to dashboard (unchanged)
//       //    - BUSINESS:   go to checkout (Sign-up → payment → dashboard)
//       if (origin === 'signup') {
//         if (userType === 'business') {
//           const checkoutRes = await fetch('/api/checkout/create-session', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ packageType: 'business' }),
//           });

//           if (!checkoutRes.ok) {
//             const msg = await safeMessage(checkoutRes);
//             console.error('[SignupForm] Checkout session (business@signup) failed:', msg);
//             // Land on Upgrade page (still logged in) so the user can retry
//             window.location.href = '/dashboard/upgrade?error=checkout';
//             return;
//           }

//           const { url } = (await checkoutRes.json()) as { url?: string };
//           if (url) {
//             window.location.href = url; // hard redirect to Stripe
//             return;
//           }

//           console.error('[SignupForm] Missing Stripe checkout URL in response');
//           window.location.href = '/dashboard/upgrade?error=no_url';
//           return;
//         }

//         // INDIVIDUAL via "signup" origin → unchanged behavior
//         window.location.href = redirectTo; // usually "/dashboard"
//         return;
//       }

//       // ----------------------------------------------------------------
//       // B) If this is the "services" origin:
//       //    Respect postSignupBehavior (default 'checkout') for Individuals.
//       if (postSignupBehavior === 'checkout') {
//         const packageType = normalizePackage();

//         const checkoutRes = await fetch('/api/checkout/create-session', {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({ packageType }),
//         });

//         if (!checkoutRes.ok) {
//           const msg = await safeMessage(checkoutRes);
//           console.error('[SignupForm] Checkout session creation failed:', msg);
//           // If checkout fails for any reason, land on Upgrade page (still logged in)
//           window.location.href = '/dashboard/upgrade?error=checkout';
//           return;
//         }

//         const { url } = (await checkoutRes.json()) as { url?: string };
//         if (url) {
//           window.location.href = url; // hard redirect to Stripe
//           return;
//         }

//         console.error('[SignupForm] Missing Stripe checkout URL in response');
//         window.location.href = '/dashboard/upgrade?error=no_url';
//         return;
//       }

//       // C) Alternate: go straight to dashboard
//       window.location.href = redirectTo;
//     } catch (err: any) {
//       console.error('[SignupForm] Error:', err);
//       setError(err.message || 'Something went wrong. Please try again.');
//       setLoading(false);
//     }
//   };

//   // ✅ NEW (minimal): tiny handler that toggles password visibility
//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   const isSignupOrigin = origin === 'signup';

//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="w-full max-w-xl bg-white rounded-xl shadow p-6 space-y-4"
//       aria-busy={loading}
//       aria-live="polite"
//       noValidate
//     >
//       {/* Error banner */}
//       {error && (
//         <div role="alert" className="bg-red-50 text-red-700 border border-red-200 rounded p-3 text-sm">
//           {error}
//         </div>
//       )}

//       {/* Name */}
//       <div>
//         <label htmlFor="name" className="block text-sm font-medium mb-1">Full name</label>
//         <input
//           id="name"
//           type="text"
//           className="w-full border rounded px-3 py-2"
//           value={name}
//           onChange={(e) => setName(e.target.value)}
//           placeholder="Jane Doe"
//           autoComplete="name"
//           required
//         />
//       </div>

//       {/* Email */}
//       <div>
//         <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
//         <input
//           id="email"
//           type="email"
//           className="w-full border rounded px-3 py-2"
//           value={email}
//           onChange={(e) => setEmail(e.target.value)}
//           placeholder="jane@example.com"
//           autoComplete="email"
//           required
//         />
//       </div>

//       {/* Password */}
//       <div>
//         <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>

//         {/**
//          * ✅ Minimal structural change:
//          * Wrap the input in a relatively-positioned container and add a small
//          * "Show / Hide" button on the right. We add extra right padding to the input
//          * (pr-20) so the text does not overlap the button.
//          *
//          * Accessibility:
//          * - Button has aria-label that reflects current action
//          * - Button is type="button" so it does not submit the form
//          */}
//         <div className="relative">
//           <input
//             id="password"
//             type={showPassword ? 'text' : 'password'}                 // ← toggled type
//             className="w-full border rounded px-3 py-2 pr-20"         // ← space for the toggle button
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             placeholder="••••••••"
//             autoComplete="new-password"
//             required
//             minLength={8}
//           />
//           <button
//             type="button"
//             onClick={togglePasswordVisibility}
//             className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-600 hover:underline focus:outline-none"
//             aria-label={showPassword ? 'Hide password' : 'Show password'}
//           >
//             {showPassword ? 'Hide' : 'Show'}
//           </button>
//         </div>

//         <p className="text-xs text-gray-500 mt-1">
//           Must be at least 8 characters and include uppercase, lowercase, number, and special.
//         </p>
//       </div>

//       {/* Account type */}
//       <fieldset>
//         <legend className="block text-sm font-medium mb-2">Account type</legend>
//         <div className="flex items-center gap-6">
//           <label className="inline-flex items-center gap-2">
//             <input
//               type="radio"
//               name="userType"
//               value="individual"
//               checked={userType === 'individual'}
//               onChange={() => setUserType('individual')}
//             />
//             <span>Individual</span>
//           </label>

//           <label className="inline-flex items-center gap-2">
//             <input
//               type="radio"
//               name="userType"
//               value="business"
//               checked={userType === 'business'}
//               onChange={() => setUserType('business')}
//             />
//             <span>Business</span>
//           </label>
//         </div>
//       </fieldset>

//       {/* Business name (only for business) */}
//       {userType === 'business' && (
//         <div>
//           <label htmlFor="businessName" className="block text-sm font-medium mb-1">Business name</label>
//           <input
//             id="businessName"
//             type="text"
//             className="w-full border rounded px-3 py-2"
//             value={businessName}
//             onChange={(e) => setBusinessName(e.target.value)}
//             placeholder="Acme Pty Ltd"
//             required
//           />
//         </div>
//       )}

//       {/* Submit */}
//       <button
//         type="submit"
//         disabled={loading}
//         className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded"
//       >
//         {loading ? 'Creating account…' : 'Create account'}
//       </button>

//       {/* Footnote (SSR-stable) */}
//       <p className="text-xs text-gray-500 text-center">
//         {isSignupOrigin ? (
//           userType === 'business'
//             ? <>After signup you’ll be taken to checkout for: <strong>business</strong>.</>
//             : <>After signup you’ll land on your dashboard (you can upgrade any time).</>
//         ) : (
//           <>After signup you’ll be taken to checkout for: <strong>{normalizePackage()}</strong></>
//         )}
//       </p>
//     </form>
//   );
// }










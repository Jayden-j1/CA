'use client';

/**
 * components/forms/signupForm.tsx
 *
 * Purpose
 * -------
 * A self-contained signup form that:
 *  1) Creates an account via /api/auth/signup
 *  2) Silently signs the user in (NextAuth credentials, no redirect)
 *  3) Immediately creates a Stripe Checkout Session for the selected package
 *  4) Hard-redirects the browser to the Stripe Checkout URL
 *
 * Why this design?
 * ----------------
 * - Efficiency: minimal round-trips, server-resolved pricing (never trust client amounts)
 * - Robustness: defensive checks, clear errors, loading guards, safe fallbacks
 * - Simplicity: plain React + fetch, no extra libraries
 * - Ease of management: single place controls the entire signup→checkout flow
 * - Security: backend validates passwords & amounts; we never expose prices from client
 * - Best practices: graceful fallbacks to dashboard/upgrade if something fails
 */

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';

/** Stripe package choices your project supports */
export type PackageType = 'individual' | 'business' | 'staff_seat';

/**
 * Props passed in by the signup page:
 * - redirectTo:      where to go if we’re NOT sending to checkout (fallback)
 * - postSignupBehavior:
 *      'checkout' → create Stripe session and redirect to Stripe
 *      'dashboard' → go straight to redirectTo (e.g., /dashboard)
 * - selectedPackage: package to purchase after signup (from /signup?package=…)
 */
export interface SignupFormProps {
  redirectTo?: string;
  postSignupBehavior?: 'checkout' | 'dashboard';
  selectedPackage?: PackageType;
}

/** Internal type for the form’s “account type” radio control */
type UserType = 'individual' | 'business';

export default function SignupForm({
  redirectTo = '/dashboard',
  postSignupBehavior = 'dashboard',
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
          userType, // 'individual' | 'business' → your API maps to role
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

      // 3) Happy path: immediately send to Stripe Checkout
      if (postSignupBehavior === 'checkout') {
        const packageType = normalizePackage();

        const checkoutRes = await fetch('/api/checkout/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packageType }),
        });

        if (!checkoutRes.ok) {
          const msg = await safeMessage(checkoutRes);
          // Fallback: go to upgrade page in the dashboard so the user can try again
          console.error('[SignupForm] Checkout session creation failed:', msg);
          window.location.href = '/dashboard/upgrade?canceled=true';
          return;
        }

        const { url } = (await checkoutRes.json()) as { url?: string };
        if (url) {
          window.location.href = url; // Hard redirect to Stripe
          return;
        }

        // Extremely rare: server responded OK but didn’t return a URL
        console.error('[SignupForm] Missing Stripe checkout URL in response');
        window.location.href = '/dashboard/upgrade?canceled=true';
        return;
      }

      // 4) Alternate path: go straight to dashboard (not used for services flow)
      window.location.href = redirectTo;
    } catch (err: any) {
      console.error('[SignupForm] Error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  // --------------------------
  // Render
  // --------------------------
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

      {/* Tiny footnote for clarity */}
      <p className="text-xs text-gray-500 text-center">
        After signup you’ll be taken to checkout for:{' '}
        <strong>{normalizePackage()}</strong>
      </p>
    </form>
  );
}









// 'use client';

// import ButtonWithSpinner from "../ui/buttonWithSpinner";
// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";
// import { useRouter } from "next/navigation";
// import { emailRegex, suggestDomain } from "@/utils/emailValidation";
// import {
//   showRoleToast,
//   showRoleErrorToast,
//   showSystemErrorToast,
// } from "@/lib/toastMessages";


// export type PackageType = "individual" | "business" | "staff_seat";

// interface SignupFormProps {
//   redirectTo?: string;
//   postSignupBehavior?: "checkout" | "dashboard";  // NEW: controls what happens after signup
//   selectedPackage?: PackageType;   // NEW: which package the user selected (passed to checkout)
// }

// export default function SignupForm({ redirectTo }: SignupFormProps) {
//   // ------------------------------
//   // State
//   // ------------------------------
//   const [showPassword, setShowPassword] = useState(false);
//   const [userType, setUserType] = useState<"individual" | "business">("individual");
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [businessName, setBusinessName] = useState("");
//   const [loading, setLoading] = useState(false);

//   const router = useRouter();
//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // ------------------------------
//   // Handle signup
//   // ------------------------------
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     try {
//       // --------------------------
//       // 1. Call signup API
//       // --------------------------
//       const response = await fetch("/api/auth/signup", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           name,
//           email,
//           password,
//           userType,
//           businessName: userType === "business" ? businessName : undefined,
//         }),
//       });

//       const data = await response.json();

//       if (!response.ok) {
//         // Distinguish system vs validation errors
//         if (data?.systemError) {
//           showSystemErrorToast();
//         } else {
//           showRoleErrorToast("USER");
//         }
//         setLoading(false);
//         return;
//       }

//       // --------------------------
//       // 2. Success toast
//       // --------------------------
//       showRoleToast(data.role);

//       // --------------------------
//       // 3. Auto-login immediately
//       // --------------------------
//       const loginResult = await signIn("credentials", {
//         email,
//         password,
//         redirect: false,
//       });

//       if (loginResult?.error) {
//         // Parse error string/JSON like in LoginForm
//         try {
//           const parsedError = JSON.parse(loginResult.error);
//           if (parsedError?.systemError) {
//             showSystemErrorToast();
//           } else {
//             showRoleErrorToast("USER");
//           }
//         } catch {
//           if (loginResult.error === "Invalid credentials") {
//             showRoleErrorToast("USER"); // wrong password/email
//           } else {
//             showSystemErrorToast(); // treat everything else as system failure
//           }
//         }
//         setLoading(false);
//         return;
//       }

//       // --------------------------
//       // 4. Redirect on success
//       // --------------------------
//       setTimeout(() => {
//         router.push(redirectTo || "/dashboard");
//       }, 500);
//     } catch (err) {
//       console.error("❌ [SignupForm] Unexpected error:", err);
//       showSystemErrorToast();
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
//       {/* -------------------------
//           Name
//       ------------------------- */}
//       <label htmlFor="name" className="text-left text-white font-bold text-sm md:text-base">
//         Name
//       </label>
//       <input
//         type="text"
//         id="name"
//         value={name}
//         onChange={(e) => setName(e.target.value)}
//         required
//         placeholder="Your full name"
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
//       />

//       {/* -------------------------
//           Email
//       ------------------------- */}
//       <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value.trim())}
//         required
//         placeholder="you@example.com"
//         className={`block w-full border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white
//           ${emailRegex.test(email) ? "border-green-500" : "border-red-500"}`}
//         autoComplete="email"
//         inputMode="email"
//       />
//       {!emailRegex.test(email) && suggestDomain(email) && (
//         <div className="flex items-center space-x-2 mt-1 text-yellow-400 text-sm">
//           <span>
//             Did you mean <strong>{suggestDomain(email)}</strong>?
//           </span>
//           <button
//             type="button"
//             onClick={() => setEmail(suggestDomain(email)!)}
//             className="ml-2 px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600 cursor-pointer"
//           >
//             ✅ Use this
//           </button>
//         </div>
//       )}

//       {/* -------------------------
//           Password
//       ------------------------- */}
//       <label htmlFor="password" className="text-left text-white font-bold text-sm md:text-base">
//         Password
//       </label>
//       <div className="relative">
//         <input
//           type={showPassword ? "text" : "password"}
//           id="password"
//           value={password}
//           onChange={(e) => setPassword(e.target.value)}
//           required
//           placeholder="Enter your password"
//           className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white"
//         />
//         <button
//           type="button"
//           onClick={togglePasswordVisibility}
//           className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none cursor-pointer"
//           tabIndex={-1}
//         >
//           {showPassword ? "Hide" : "Show"}
//         </button>
//       </div>

//       {/* -------------------------
//           User type
//       ------------------------- */}
//       <fieldset className="mt-4 pt-4">
//         <legend className="text-white font-bold text-sm md:text-base mb-2">I am signing up as:</legend>
//         <label className="flex items-center gap-2 text-white">
//           <input
//             type="radio"
//             name="userType"
//             value="individual"
//             checked={userType === "individual"}
//             onChange={() => setUserType("individual")}
//             className="accent-green-500 cursor-pointer"
//           />
//           Individual
//         </label>
//         <label className="flex items-center gap-2 text-white">
//           <input
//             type="radio"
//             name="userType"
//             value="business"
//             checked={userType === "business"}
//             onChange={() => setUserType("business")}
//             className="accent-green-500 cursor-pointer"
//           />
//           Business
//         </label>
//       </fieldset>

//       {userType === "business" && (
//         <>
//           <label htmlFor="businessName" className="text-left text-white font-bold text-sm md:text-base">
//             Business Name
//           </label>
//           <input
//             type="text"
//             id="businessName"
//             value={businessName}
//             onChange={(e) => setBusinessName(e.target.value)}
//             required={userType === "business"}
//             placeholder="Your company name"
//             className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
//           />
//         </>
//       )}

//       {/* -------------------------
//           Submit
//       ------------------------- */}
//       <div className="text-center">
//         <ButtonWithSpinner type="submit" loading={loading}>
//           {loading ? "Signing Up..." : "Sign Up"}
//         </ButtonWithSpinner>
//       </div>

//       {/* -------------------------
//           Footer
//       ------------------------- */}
//       <aside>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           Already have an account?
//           <a href="/login" className="text-white hover:underline font-bold ml-1">
//             Log in
//           </a>
//           .
//         </p>
//       </aside>
//     </form>
//   );
// }










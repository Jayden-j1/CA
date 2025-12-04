// components/forms/loginForm.tsx
"use client";

/**
 * What changed and why:
 * ---------------------
 * - We now normalize the email (trim + lowercase) before sending it to
 *   next-auth. This keeps behaviour consistent with signup + forgot-password
 *   flows, which also treat emails as case-insensitive identifiers.
 * - We continue to show a friendly, non-technical toast when the credentials
 *   are wrong: `showInvalidCredentialsToast()`.
 * - System/infra errors still use `showSystemErrorToast()`.
 *
 * Minimal surface change:
 * - We only normalize the email in handleSubmit; the rest of the UI and logic
 *   remain unchanged.
 */

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  showRoleToast,
  showRoleErrorToast,
  showSystemErrorToast,
  showInvalidCredentialsToast,
} from "@/lib/toastMessages";

export default function LoginForm() {
  // State
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  // Handle login
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Normalize email before sending it to the server:
      // - trim whitespace
      // - lowercase for case-insensitive identity
      const normalizedEmail = email.trim().toLowerCase();

      const result = await signIn("credentials", {
        redirect: false,
        email: normalizedEmail,
        password,
      });

      // --- Error branch (no redirect happened) ---
      if (result?.error) {
        /**
         * NextAuth `Credentials` provider commonly returns:
         * - `"Invalid credentials"` (custom)
         * - `"CredentialsSignin"` (generic)
         * - or a JSON string (you already send `{ systemError: true }` sometimes)
         * We map all “wrong email/password” outcomes to a clear, friendly toast.
         */
        try {
          const parsed = JSON.parse(result.error);

          // Explicit server flag for unexpected errors
          if (parsed?.systemError) {
            showSystemErrorToast();
            return;
          }

          // Optional: if your API ever sends codes like below, we map them
          if (
            parsed?.code === "INVALID_CREDENTIALS" ||
            parsed?.code === "USER_NOT_FOUND" ||
            parsed?.code === "WRONG_PASSWORD"
          ) {
            showInvalidCredentialsToast();
            return;
          }

          // Any other structured error falls back to friendly invalid credentials
          showInvalidCredentialsToast();
          return;
        } catch {
          // Plain string errors
          const msg = String(result.error || "");
          if (
            msg === "Invalid credentials" ||
            msg === "CredentialsSignin" ||
            /invalid|credential|password|user|email/i.test(msg)
          ) {
            // Friendly error for wrong email/password
            showInvalidCredentialsToast();
          } else {
            // Anything else → system error (server/network)
            showSystemErrorToast();
          }
          return;
        }
      }

      // --- Success branch ---
      // Reconfirm session to get role (you already had this pattern)
      const sessionRes = await fetch("/api/auth/session");
      if (!sessionRes.ok) {
        showSystemErrorToast();
        return;
      }
      const session = await sessionRes.json();

      // Role-based success toast (unchanged)
      showRoleToast(session?.user?.role);

      // Small delay for UX polish
      setTimeout(() => {
        router.push("/dashboard");
      }, 500);
    } catch (err) {
      // True unexpected client error (network, runtime, etc.)
      console.error("[LoginForm] Unexpected error:", err);
      showSystemErrorToast();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
    >
      {/* Email */}
      <label
        htmlFor="email"
        className="text-left text-white font-bold text-sm md:text-base"
      >
        Email
      </label>
      <input
        type="email"
        id="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
        aria-invalid={false}
      />

      {/* Password */}
      <label
        htmlFor="password"
        className="text-left text-white font-bold text-sm md:text-base"
      >
        Password
      </label>
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white"
          aria-invalid={false}
        />
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none"
          tabIndex={-1}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>

      {/* Submit */}
      <div className="text-center">
        <button
          type="submit"
          disabled={loading}
          className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-2xl shadow border-2 border-white disabled:opacity-60"
          aria-busy={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>

      {/* Footer */}
      <aside>
        <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
          <a href="/forgot-password" className="text-white hover:underline font-bold ml-1">
            Forgot your Password?
          </a>
        </p>
        <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
          Don’t have an account?
          <a href="/signup" className="text-white hover:underline font-bold ml-1">
            Join Now.
          </a>
        </p>
      </aside>
    </form>
  );
}









// // components/forms/loginForm.tsx
// 'use client';

// /**
//  * What changed and why:
//  * ---------------------
//  * - We now show a friendly, non-technical toast when the credentials are wrong:
//  *   `showInvalidCredentialsToast()` → “We couldn’t find an account with that email
//  *   or the password is incorrect.”
//  * - We still show the system error toast for real server/network errors.
//  * - We keep role-based success toasts exactly as before.
//  *
//  * Minimal surface change:
//  * - Only the error mapping in handleSubmit changed; all UI and flow are unchanged.
//  */

// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";
// import { useRouter } from "next/navigation";
// import {
//   showRoleToast,
//   showRoleErrorToast,
//   showSystemErrorToast,
//   showInvalidCredentialsToast, // new friendlier toast
// } from "@/lib/toastMessages";

// export default function LoginForm() {
//   // State
//   const [showPassword, setShowPassword] = useState(false);
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [loading, setLoading] = useState(false);

//   const router = useRouter();
//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // Handle login
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     try {
//       const result = await signIn("credentials", {
//         redirect: false,
//         email,
//         password,
//       });

//       // --- Error branch (no redirect happened) ---
//       if (result?.error) {
//         /**
//          * NextAuth `Credentials` provider commonly returns:
//          * - `"Invalid credentials"` (custom)
//          * - `"CredentialsSignin"` (generic)
//          * - or a JSON string (you already send `{ systemError: true }` sometimes)
//          * We map all “wrong email/password” outcomes to a clear, friendly toast.
//          */
//         try {
//           const parsed = JSON.parse(result.error);

//           // Explicit server flag for unexpected errors
//           if (parsed?.systemError) {
//             showSystemErrorToast();
//             return;
//           }

//           // Optional: if your API ever sends codes like below, we map them
//           if (
//             parsed?.code === "INVALID_CREDENTIALS" ||
//             parsed?.code === "USER_NOT_FOUND" ||
//             parsed?.code === "WRONG_PASSWORD"
//           ) {
//             showInvalidCredentialsToast();
//             return;
//           }

//           // Any other structured error falls back to friendly invalid credentials
//           showInvalidCredentialsToast();
//           return;
//         } catch {
//           // Plain string errors
//           const msg = String(result.error || "");
//           if (
//             msg === "Invalid credentials" ||
//             msg === "CredentialsSignin" ||
//             /invalid|credential|password|user|email/i.test(msg)
//           ) {
//             // Friendly error for wrong email/password
//             showInvalidCredentialsToast();
//           } else {
//             // Anything else → system error (server/network)
//             showSystemErrorToast();
//           }
//           return;
//         }
//       }

//       // --- Success branch ---
//       // Reconfirm session to get role (you already had this pattern)
//       const sessionRes = await fetch("/api/auth/session");
//       if (!sessionRes.ok) {
//         showSystemErrorToast();
//         return;
//       }
//       const session = await sessionRes.json();

//       // Role-based success toast (unchanged)
//       showRoleToast(session?.user?.role);

//       // Small delay for UX polish
//       setTimeout(() => {
//         router.push("/dashboard");
//       }, 500);
//     } catch (err) {
//       // True unexpected client error (network, runtime, etc.)
//       console.error("[LoginForm] Unexpected error:", err);
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
//       {/* Email */}
//       <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value)}
//         required
//         autoComplete="email"
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
//         aria-invalid={false}
//       />

//       {/* Password */}
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
//           autoComplete="current-password"
//           className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white"
//           aria-invalid={false}
//         />
//         <button
//           type="button"
//           onClick={togglePasswordVisibility}
//           className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none"
//           tabIndex={-1}
//           aria-label={showPassword ? "Hide password" : "Show password"}
//         >
//           {showPassword ? "Hide" : "Show"}
//         </button>
//       </div>

//       {/* Submit */}
//       <div className="text-center">
//         <button
//           type="submit"
//           disabled={loading}
//           className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-2xl shadow border-2 border-white disabled:opacity-60"
//           aria-busy={loading}
//         >
//           {loading ? "Logging in..." : "Login"}
//         </button>
//       </div>

//       {/* Footer */}
//       <aside>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           <a href="/forgot-password" className="text-white hover:underline font-bold ml-1">
//             Forgot your Password?
//           </a>
//         </p>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           Don’t have an account?
//           <a href="/signup" className="text-white hover:underline font-bold ml-1">
//             Join Now.
//           </a>
//         </p>
//       </aside>
//     </form>
//   );
// }

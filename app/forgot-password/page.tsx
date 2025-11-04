// app/forgot-password/page.tsx
//
// Purpose:
// - Client page for requesting a password reset.
// - Posts to /api/auth/forgot-password.
// - Shows a unified toast: “If that email exists, a reset link has been sent.”
//
// Surgical updates:
// - Trim/lower email before submit to match server normalization.
// - Minor a11y/UX touchups. No changes to your app layout or routes.
//
// Prereq:
// - Ensure <Toaster /> is mounted in your root layout.

"use client";

import { useState } from "react";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      toast.error("Please enter your email.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });

      // We always show success toast to avoid user enumeration
      if (res.ok) {
        toast.success("If that email exists, a reset link has been sent.");
        setEmail("");
      } else {
        // Even non-200 should be rare; keep this generic for consistency.
        toast.success("If that email exists, a reset link has been sent.");
      }
    } catch (err) {
      console.error("[ForgotPasswordPage] Error:", err);
      toast.success("If that email exists, a reset link has been sent.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-h-[70vh] flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
      <form
        onSubmit={onSubmit}
        className="w-[90%] max-w-md bg-white rounded-xl shadow p-6 space-y-4"
        aria-busy={loading}
      >
        <h1 className="text-xl font-bold">Forgot your password?</h1>
        <p className="text-sm text-gray-600">
          Enter your email and we’ll send a link to reset your password.
        </p>

        <label htmlFor="fp-page-email" className="block text-sm font-semibold">Email</label>
        <input
          id="fp-page-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="you@company.com"
          autoComplete="email"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-500 disabled:opacity-60"
          aria-busy={loading}
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>

        <p className="text-xs text-gray-500">
          <a href="/login" className="underline">Back to login</a>
        </p>
      </form>
    </section>
  );
}









// // app/forgot-password/page.tsx
// //
// // Purpose:
// // - Client page for requesting a password reset.
// // - Posts to /api/auth/forgot-password.
// // - Shows a unified toast: “If that email exists, a reset link has been sent.”
// //
// // UX:
// // - We don't reveal whether the email exists (security best practice).
// // - Strong passwords enforced later on the reset page/API.
// //
// // Prereq:
// // - Ensure <Toaster /> is mounted in your root layout.

// "use client";

// import { useState } from "react";
// import toast from "react-hot-toast";

// export default function ForgotPasswordPage() {
//   const [email, setEmail] = useState("");
//   const [loading, setLoading] = useState(false);

//   async function onSubmit(e: React.FormEvent) {
//     e.preventDefault();
//     setLoading(true);

//     try {
//       const res = await fetch("/api/auth/forgot-password", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ email }),
//       });

//       // We always show success toast to avoid user enumeration
//       if (res.ok) {
//         toast.success("If that email exists, a reset link has been sent.");
//         setEmail("");
//       } else {
//         toast.error("Unable to process request. Try again later.");
//       }
//     } catch (err) {
//       console.error("[ForgotPasswordPage] Error:", err);
//       toast.error("Internal error. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <section className="min-h-[70vh] flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
//       <form
//         onSubmit={onSubmit}
//         className="w-[90%] max-w-md bg-white rounded-xl shadow p-6 space-y-4"
//       >
//         <h1 className="text-xl font-bold">Forgot your password?</h1>
//         <p className="text-sm text-gray-600">
//           Enter your email and we’ll send a link to reset your password.
//         </p>

//         <label className="block text-sm font-semibold">Email</label>
//         <input
//           type="email"
//           required
//           value={email}
//           onChange={(e) => setEmail(e.target.value)}
//           className="w-full border rounded px-3 py-2"
//           placeholder="you@company.com"
//         />

//         <button
//           type="submit"
//           disabled={loading}
//           className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-500 disabled:opacity-60"
//         >
//           {loading ? "Sending..." : "Send reset link"}
//         </button>
//       </form>
//     </section>
//   );
// }

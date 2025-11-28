// app/reset-password/[token]/page.tsx
//
// Purpose
// -------
// Public page that renders your <ResetPasswordForm /> with the secure token
// from the URL. Users arrive here via the emailed reset link.
//
// Why this structure?
// -------------------
// - Next.js 15 types dynamic routes so that `params` is a Promise.
// - We accept that shape, `await` it, and then pass `token` down to the
//   client-side ResetPasswordForm component.
// - This keeps the server ↔ client boundary clean: the page unwraps the URL,
//   the form handles user input + calls /api/auth/reset-password.
//
// Pillars
// -------
// Efficiency   – minimal async work: just unwrap route params.
// Robustness   – handles missing/invalid token gracefully with a clear message.
// Simplicity   – one self-contained page component delegating to the form.
// Security     – token is never logged; only passed where needed.
// Ease of mgmt – matches your existing form API contract.

import Link from "next/link";
import ResetPasswordForm from "@/components/forms/ResetPassword";

// NOTE: In Next 15, the inferred PageProps for dynamic routes treat
// `params` (and sometimes `searchParams`) as Promises. We accept that shape
// and immediately unwrap it with `await`, which resolves the type expectations.
export default async function ResetPasswordPage(props: {
  params: Promise<{ token: string }>;
  // If you ever need query flags (e.g. ?success=true), you can add:
  // searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // 1) Unwrap the promised route params to access the token segment.
  const { token } = await props.params;

  // 2) Guard for missing token (corrupt URL / manual visit).
  //    We do NOT log the token and we keep responses generic.
  if (!token) {
    return (
      <section className="w-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300 px-4">
        <h1 className="text-white font-bold text-2xl sm:text-3xl md:text-4xl mb-4">
          Invalid or missing reset link
        </h1>
        <p className="text-blue-100 mb-6 text-center max-w-xl">
          Your password reset link may have expired, been used already, or is
          incomplete. Please request a new reset link.
        </p>
        <Link
          href="/login"
          className="underline underline-offset-2 text-white hover:text-blue-50"
        >
          Return to login
        </Link>
      </section>
    );
  }

  // 3) Happy path:
  //    - We render the reset UI, passing the token into the client form.
  //    - <ResetPasswordForm /> is responsible for:
  //        • collecting new password,
  //        • calling /api/auth/reset-password with { token, password },
  //        • handling success/error toasts + any redirects.
  return (
    <section className="w-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300 px-4">
      <h1 className="text-white font-bold text-3xl sm:text-4xl md:text-5xl mb-6 text-center">
        Choose a new password
      </h1>

      {/* Client component that owns the reset-password UX & API call */}
      <ResetPasswordForm token={token} />
    </section>
  );
}









// // app/reset-password/[token]/page.tsx
// //
// // Purpose
// // -------
// // Public page that renders your ResetPasswordForm with the secure token
// // from the URL. This version satisfies Next.js 15’s typed dynamic routes,
// // where `params` (and optionally `searchParams`) are Promises.
// //
// // Key Fixes
// // ---------
// // • Accept `params` as a Promise and `await` it (Next 15 build requirement).
// // • Keep UI minimal and consistent with the rest of your app.
// // • Do NOT log the token (security).
// //
// // Pillars
// // -------
// // Efficiency   – minimal async work before render
// // Robustness   – handles missing/invalid token gracefully
// // Simplicity   – one self-contained page component
// // Security     – token never logged or exposed elsewhere
// // Ease of mgmt – matches your existing form API contract

// import Link from "next/link";
// import ResetPasswordForm from "@/components/forms/ResetPassword";

// // NOTE: In Next 15, the inferred PageProps for dynamic routes treat
// // `params` (and sometimes `searchParams`) as Promises. We accept that shape
// // and immediately unwrap it with `await`, which resolves the Vercel type error.
// export default async function ResetPasswordPage(props: {
//   params: Promise<{ token: string }>;
//   // If you ever need `?success=true` etc. you can uncomment this:
//   // searchParams?: Promise<Record<string, string | string[] | undefined>>;
// }) {
//   // 1) Unwrap the promised route params.
//   const { token } = await props.params;

//   // 2) Guard for missing token (corrupt URL / manual visit).
//   if (!token) {
//     return (
//       <section className="w-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300 px-4">
//         <h1 className="text-white font-bold text-2xl sm:text-3xl md:text-4xl mb-4">
//           Invalid or missing reset link
//         </h1>
//         <p className="text-blue-100 mb-6 text-center max-w-xl">
//           Your password reset link may have expired or been used already. Please
//           request a new reset link.
//         </p>
//         <Link
//           href="/login"
//           className="underline underline-offset-2 text-white hover:text-blue-50"
//         >
//           Return to login
//         </Link>
//       </section>
//     );
//   }

//   // 3) Happy path: render the form and pass the secure token down.
//   return (
//     <section className="w-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300 px-4">
//       <h1 className="text-white font-bold text-3xl sm:text-4xl md:text-5xl mb-6">
//         Choose a new password
//       </h1>

//       {/* The client component that handles user input and POSTs to your API. */}
//       <ResetPasswordForm token={token} />
//     </section>
//   );
// }

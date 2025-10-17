// app/signup/page.tsx
//
// Purpose
// -------
// - Server component for the Signup page.
// - Reads the `?package=` query (now delivered as a Promise in Next.js 15),
//   normalizes it, and passes the chosen package to <SignupForm />.
//
// What changed (Next.js 15 typed routes)
// -------------------------------------
// • Server components now receive `searchParams` as a Promise.
// • We mark the component `async` and `await` it at the top.
// • We also guard against string[] and undefined to keep things robust.
//
// Pillars
// -------
// ✅ Efficiency  – zero extra fetches; only simple normalization
// ✅ Robustness  – handles string | string[] | undefined; strict allow-list
// ✅ Simplicity  – small, self-contained helper
// ✅ Ease of mgmt – clear comments and types
// ✅ Security     – ignores unexpected values; falls back to a safe default

import TopofPageContent from "../../components/topPage/topOfPageStyle";
import SignupForm from "../../components/forms/signupForm";

// Allowed package types for checkout
type PackageType = "individual" | "business" | "staff_seat";

// Next.js 15 server components: searchParams is a Promise.
// We make the component async and await it once.
export default async function SignupPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Await once at the top; default to empty object if missing
  const rawSearch = (await props.searchParams) ?? {};
  const rawParam = rawSearch.package;

  // Normalize the value into a single lowercased string
  // rawParam can be: string | string[] | undefined
  const packageParam =
    Array.isArray(rawParam) ? (rawParam[0] ?? "").toLowerCase() : (rawParam ?? "").toLowerCase();

  // Strict allow-list; anything else falls back to "individual"
  const allowed: PackageType[] = ["individual", "business", "staff_seat"];
  const selectedPackage: PackageType = allowed.includes(packageParam as PackageType)
    ? (packageParam as PackageType)
    : "individual";

  return (
    <>
      <main>
        <TopofPageContent
          HeadingOneTitle="Join Today"
          paragraphContent="Get access to our cultural awareness content packages."
          linkOne="Already have an account? Log in"
          href="/login"
        />
      </main>

      <section className="w-full flex flex-col justify-center items-center bg-gradient-to-b from-blue-700 to-blue-300 mt-40">
        <h2 className="text-white font-bold text-3xl sm:text-4xl md:text-5xl tracking-wide px-4 sm:px-0 py-8 text-center text-shadow-2xl">
          Sign Up
        </h2>

        {/* We pass the normalized package so the form can create the correct Stripe Checkout */}
        <SignupForm
          redirectTo="/dashboard"           // fallback (usually not hit if checkout flow starts)
          postSignupBehavior="checkout"     // after signup, go straight to Stripe Checkout
          selectedPackage={selectedPackage} // "individual" | "business" | "staff_seat"
        />
      </section>
    </>
  );
}

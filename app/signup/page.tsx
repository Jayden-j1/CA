// app/signup/page.tsx
//
// Purpose
// -------
// - Server component for the Signup page.
// - Reads the `?package=` query (delivered as a Promise in Next.js 15),
//   normalizes it, and passes the chosen package + origin='signup' to the form.
//
// Hydration safety
// ----------------
// - We pass `origin="signup"` so the client renders the same branch on hydration.
// - We also set `postSignupBehavior="dashboard"` for extra clarity (though
//   the form ignores it when origin='signup').

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

        {/* Server-driven origin prevents hydration mismatches */}
        <SignupForm
          origin="signup"                    // ← SSR-safe: dashboard flow, no Stripe on /signup
          redirectTo="/dashboard"            // Where to land after login on /signup
          postSignupBehavior="dashboard"     // (ignored when origin='signup', kept for clarity)
          selectedPackage={selectedPackage}  // still parsed; not used when origin='signup'
        />
      </section>
    </>
  );
}

// app/signup/page.tsx
//
// Purpose
// -------
// - Server component for the Signup page.
// - Reads the `?package=` and optional `?from=` queries (delivered as a Promise in Next.js 15),
//   normalizes them, and passes both the package and a *server-decided* origin to <SignupForm />.
//
// Hydration safety
// ----------------
// - We compute `origin` on the server (no window checks), so the server and client render the
//   same branch and avoid hydration mismatches.
//
// Flow
// ----
// - If `from=services`, we pass origin="services" so the form will go straight to Stripe
//   after account creation (using the selected package).
// - Otherwise we pass origin="signup" (dashboard after signup; user can upgrade later).

import TopofPageContent from "../../components/topPage/topOfPageStyle";
import SignupForm, { type SignupOrigin } from "../../components/forms/signupForm";

// Allowed package types for checkout
type PackageType = "individual" | "business" | "staff_seat";

export default async function SignupPage(props: {
  // Next.js 15: searchParams arrives as a Promise
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawSearch = (await props.searchParams) ?? {};
  const rawPackage = rawSearch.package;
  const rawFrom = rawSearch.from;

  // Normalize package (string | string[] | undefined → string)
  const packageParam =
    Array.isArray(rawPackage) ? (rawPackage[0] ?? "").toLowerCase() : (rawPackage ?? "").toLowerCase();
  const allowed: PackageType[] = ["individual", "business", "staff_seat"];
  const selectedPackage: PackageType = allowed.includes(packageParam as PackageType)
    ? (packageParam as PackageType)
    : "individual";

  // Normalize origin: 'services' or 'signup' (default)
  const fromParam =
    Array.isArray(rawFrom) ? (rawFrom[0] ?? "").toLowerCase() : (rawFrom ?? "").toLowerCase();
  const origin: SignupOrigin = fromParam === "services" ? "services" : "signup";

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

      <section className="w-full flex flex-col justify-center items-center bg-linear-to-b from-blue-700 to-blue-300 mt-40">
        <h2 className="text-white font-bold text-3xl sm:text-4xl md:text-5xl tracking-wide px-4 sm:px-0 py-8 text-center text-shadow-2xl">
          Sign Up
        </h2>

        {/* Server-driven origin prevents hydration mismatches */}
        <SignupForm
          origin={origin}                 // 'signup' → dashboard, 'services' → Stripe Checkout
          redirectTo="/dashboard"
          // For origin='signup' this is ignored; for origin='services' it's the default behavior.
          postSignupBehavior={origin === "services" ? "checkout" : "dashboard"}
          selectedPackage={selectedPackage}
        />
      </section>
    </>
  );
}

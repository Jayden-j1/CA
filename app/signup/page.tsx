// app/signup/page.tsx
//
// Purpose
// -------
// Server component that reads `?package=` and `?from=`,
// normalizes them, and passes a *server-decided* origin to <SignupForm />.
// This prevents hydration mismatches and enforces the correct flow:
// Services → Signup (create account) → Stripe Checkout → Dashboard.

import TopofPageContent from "../../components/topPage/topOfPageStyle";
import SignupForm, { type SignupOrigin } from "../../components/forms/signupForm";

type PackageType = "individual" | "business" | "staff_seat";

export default async function SignupPage(props: {
  // Next.js 15: searchParams is a Promise
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawSearch = (await props.searchParams) ?? {};
  const rawPackage = rawSearch.package;
  const rawFrom = rawSearch.from;

  const packageParam =
    Array.isArray(rawPackage) ? (rawPackage[0] ?? "").toLowerCase() : (rawPackage ?? "").toLowerCase();
  const allowed: PackageType[] = ["individual", "business", "staff_seat"];
  const selectedPackage: PackageType = allowed.includes(packageParam as PackageType)
    ? (packageParam as PackageType)
    : "individual";

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

        <SignupForm
          origin={origin}                          // 'signup' → dashboard; 'services' → Stripe
          redirectTo="/dashboard"
          postSignupBehavior={origin === "services" ? "checkout" : "dashboard"}
          selectedPackage={selectedPackage}
        />
      </section>
    </>
  );
}

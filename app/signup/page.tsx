// app/signup/page.tsx
//
// Purpose:
// - Server component that renders the signup page.
// - Reads ?package= from URL (e.g., /signup?package=individual) and passes
//   it into the SignupForm so we know which Stripe Checkout to create
//   immediately after a successful signup.
// - Defaults to "individual" if the query param is missing/invalid.

import TopofPageContent from "../../components/topPage/topOfPageStyle";
import SignupForm from "../../components/forms/signupForm";

// Allowed package types for checkout
type PackageType = "individual" | "business" | "staff_seat";

export default function SignupPage({
  searchParams,
}: {
  searchParams?: { package?: string };
}) {
  // Normalize/validate ?package= query
  const packageParam = (searchParams?.package || "").toLowerCase();
  const allowed: PackageType[] = ["individual", "business", "staff_seat"];
  const selectedPackage: PackageType = allowed.includes(packageParam as PackageType)
    ? (packageParam as PackageType)
    : "individual"; // default

  return (
    <>
      <main>
        <TopofPageContent
          HeadingOneTitle="Join Today"
          paragraphContent="Get access to our cultural awareness content packages."
          linkOne="Already have an account? Log in"
          href="/login" // Redirect to login page
        />
      </main>

      <section className="w-full flex flex-col justify-center items-center bg-gradient-to-b from-blue-700 to-blue-300 mt-40">
        <h2 className="text-white font-bold text-3xl sm:text-4xl md:text-5xl tracking-wide px-4 sm:px-0 py-8 text-center text-shadow-2xl">
          Sign Up
        </h2>

        {/* 
          NEW: We pass selectedPackage so the form can:
            - create account
            - auto sign the user in
            - immediately create Stripe Checkout for the chosen package
        */}
        <SignupForm
          redirectTo="/dashboard"                 // fallback (shouldn’t be used in the happy path)
          postSignupBehavior="checkout"           // tells the form to go to Stripe Checkout after signup
          selectedPackage={selectedPackage}       // "individual" | "business" | "staff_seat"
        />
      </section>
    </>
  );
}










// import TopofPageContent from "../../components/topPage/topOfPageStyle";
// import SignupForm from "../../components/forms/signupForm";

// export default function SignupPage() {
//   return (
//     <>
//       <main>
//         <TopofPageContent
//           HeadingOneTitle="Join Today"
//           paragraphContent="Get access to our cultural awareness content packages."
//           linkOne="Already have an account? Log in"
//           href="/login" // Redirect to login page
//         />
//       </main>

//       <section className="w-full flex flex-col justify-center items-center bg-gradient-to-b from-blue-700 to-blue-300 mt-40">
//         <h2 className="text-white font-bold text-3xl sm:text-4xl md:text-5xl tracking-wide px-4 sm:px-0 py-8 text-center text-shadow-2xl">
//           Sign Up
//         </h2>
//         <SignupForm redirectTo="/dashboard" />
//       </section>
//     </>
//   );
// }

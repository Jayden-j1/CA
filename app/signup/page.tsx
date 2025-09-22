import TopofPageContent from "../../components/topPage/topOfPageStyle";
import SignupForm from "../../components/forms/signupForm";

export default function SignupPage() {
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
        <SignupForm redirectTo="/dashboard" />
      </section>
    </>
  );
}

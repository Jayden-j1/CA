'use client';

import ButtonWithSpinner from "../ui/buttonWithSpinner"; 
import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";

// --- Email validation helpers ---
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const commonDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"];

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function suggestDomain(email: string) {
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  const suggestion = commonDomains.find((d) =>
    domain && levenshteinDistance(domain, d) <= 2
  );
  return suggestion ? `${local}@${suggestion}` : null;
}

interface SignupFormProps {
  redirectTo?: string;
}

export default function SignupForm({ redirectTo }: SignupFormProps) {
  // --- Form state ---
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState<"individual" | "business">("individual");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");

  const [loading, setLoading] = useState(false);

  // Toggle password visibility
  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  // --- Handle signup submission ---
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          userType,
          businessName: userType === "business" ? businessName : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Signup failed. Please try again.");
        setLoading(false);
        return;
      }

      if (data.role === "BUSINESS_OWNER") {
        toast.success("🎉 Welcome Business Owner! Your dashboard is ready.");
      } else {
        toast.success("🎉 Welcome aboard! Glad to have you here.");
      }

      await signIn("credentials", {
        email,
        password,
        redirect: true,
        callbackUrl: redirectTo || "/dashboard",
      });
    } catch (err) {
      console.error("❌ [SignupForm] Unexpected error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
    >
      {/* Name */}
      <label htmlFor="name" className="text-left text-white font-bold text-sm md:text-base">
        Name
      </label>
      <input
        type="text"
        id="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="Your full name"
        className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
      />

      {/* Email */}
      <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
        Email
      </label>
      <input
        type="email"
        id="email"
        value={email}
        onChange={(e) => setEmail(e.target.value.trim())}
        required
        placeholder="you@example.com"
        className={`block w-full border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white
          ${emailRegex.test(email) ? 'border-green-500' : 'border-red-500'}`}
        autoComplete="email"
        inputMode="email"
      />
      {!emailRegex.test(email) && suggestDomain(email) && (
        <p
          className="text-yellow-400 text-sm mt-1 cursor-pointer underline"
          onClick={() => setEmail(suggestDomain(email)!)}
        >
          Did you mean <strong>{suggestDomain(email)}</strong>?
        </p>
      )}

      {/* Password */}
      {/* ... rest of your code unchanged ... */}
    </form>
  );
}









// // components/forms/SignupForm.tsx
// //
// // Purpose:
// // - Signup form for both "individual" and "business" users.
// // - Calls /api/auth/signup to create a user (and business if needed).
// // - Uses role from API response to show personalized welcome toasts:
// //   - BUSINESS_OWNER → "Welcome Business Owner! Your dashboard is ready."
// //   - USER → "Welcome aboard! Glad to have you here."
// // - Then auto-logs the user in with NextAuth.
// //
// // Requirements:
// // - react-hot-toast installed
// // - Global <Toaster /> in layout.tsx for consistent branding

// 'use client';

// import ButtonWithSpinner from "../ui/buttonWithSpinner"; //  import spinner


// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";
// import toast from "react-hot-toast";

// interface SignupFormProps {
//   redirectTo?: string; // Optional redirect after signup
// }

// export default function SignupForm({ redirectTo }: SignupFormProps) {
//   // --- Form state ---
//   const [showPassword, setShowPassword] = useState(false);
//   const [userType, setUserType] = useState<"individual" | "business">("individual");
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [businessName, setBusinessName] = useState("");

//   const [loading, setLoading] = useState(false);

//   // Toggle password visibility
//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // --- Handle signup submission ---
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     try {
//       // 1️ Send signup request to backend
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

//       // 2️ Handle backend errors
//       if (!response.ok) {
//         toast.error(data.error || "Signup failed. Please try again.");
//         setLoading(false);
//         return;
//       }

//       // 3️ Role-based welcome toast
//       // role is returned by the API (thanks to backend update)
//       if (data.role === "BUSINESS_OWNER") {
//         toast.success("🎉 Welcome Business Owner! Your dashboard is ready.");
//       } else {
//         toast.success("🎉 Welcome aboard! Glad to have you here.");
//       }

//       // 4️ Auto-login after signup
//       await signIn("credentials", {
//         email,
//         password,
//         redirect: true,
//         callbackUrl: redirectTo || "/dashboard",
//       });
//     } catch (err) {
//       console.error("❌ [SignupForm] Unexpected error:", err);
//       toast.error("Something went wrong. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // --- Render form ---
//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
//       {/* Name */}
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
//         placeholder="you@example.com"
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
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
//           placeholder="Enter your password"
//           className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white"
//         />
//         <button
//           type="button"
//           onClick={togglePasswordVisibility}
//           className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none"
//           tabIndex={-1}
//         >
//           {showPassword ? "Hide" : "Show"}
//         </button>
//       </div>

//       {/* User Type Selection */}
//       <fieldset className="mt-4 pt-4">
//         <legend className="text-white font-bold text-sm md:text-base mb-2">
//           I am signing up as:
//         </legend>
//         <label className="flex items-center gap-2 text-white">
//           <input
//             type="radio"
//             name="userType"
//             value="individual"
//             checked={userType === "individual"}
//             onChange={() => setUserType("individual")}
//             className="accent-green-500"
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
//             className="accent-green-500"
//           />
//           Business
//         </label>
//       </fieldset>

//       {/* Business Name (only if Business is selected) */}
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

//       {/* Submit Button */}
//       <div className="text-center">
//         <ButtonWithSpinner type="submit" loading={loading}>
//           {loading ? "Signing Up..." : "Sign Up"}
//         </ButtonWithSpinner>
//       </div>

//       {/* Links */}
//       <aside>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           Already have an account?
//           <a href="/login" className="text-white hover:underline font-bold ml-1">
//             Log in
//           </a>.
//         </p>
//       </aside>
//     </form>
//   );
// }










// components/forms/SignupForm.tsx
//
// Purpose:
// - Signup form for both "individual" and "business" users.
// - Calls /api/auth/signup to create a user (and business if needed).
// - Uses role from API response to show personalized welcome toasts:
//   - BUSINESS_OWNER → "Welcome Business Owner! Your dashboard is ready."
//   - USER → "Welcome aboard! Glad to have you here."
// - Then auto-logs the user in with NextAuth.
//
// Requirements:
// - react-hot-toast installed
// - Global <Toaster /> in layout.tsx for consistent branding

'use client';

import ButtonWithSpinner from "../ui/buttonWithSpinner"; //  import spinner


import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";

interface SignupFormProps {
  redirectTo?: string; // Optional redirect after signup
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
      // 1️ Send signup request to backend
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

      // 2️ Handle backend errors
      if (!response.ok) {
        toast.error(data.error || "Signup failed. Please try again.");
        setLoading(false);
        return;
      }

      // 3️ Role-based welcome toast
      // role is returned by the API (thanks to backend update)
      if (data.role === "BUSINESS_OWNER") {
        toast.success("🎉 Welcome Business Owner! Your dashboard is ready.");
      } else {
        toast.success("🎉 Welcome aboard! Glad to have you here.");
      }

      // 4️ Auto-login after signup
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

  // --- Render form ---
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
        onChange={(e) => setEmail(e.target.value)}
        required
        placeholder="you@example.com"
        className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
      />

      {/* Password */}
      <label htmlFor="password" className="text-left text-white font-bold text-sm md:text-base">
        Password
      </label>
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Enter your password"
          className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white"
        />
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none"
          tabIndex={-1}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>

      {/* User Type Selection */}
      <fieldset className="mt-4 pt-4">
        <legend className="text-white font-bold text-sm md:text-base mb-2">
          I am signing up as:
        </legend>
        <label className="flex items-center gap-2 text-white">
          <input
            type="radio"
            name="userType"
            value="individual"
            checked={userType === "individual"}
            onChange={() => setUserType("individual")}
            className="accent-green-500"
          />
          Individual
        </label>
        <label className="flex items-center gap-2 text-white">
          <input
            type="radio"
            name="userType"
            value="business"
            checked={userType === "business"}
            onChange={() => setUserType("business")}
            className="accent-green-500"
          />
          Business
        </label>
      </fieldset>

      {/* Business Name (only if Business is selected) */}
      {userType === "business" && (
        <>
          <label htmlFor="businessName" className="text-left text-white font-bold text-sm md:text-base">
            Business Name
          </label>
          <input
            type="text"
            id="businessName"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required={userType === "business"}
            placeholder="Your company name"
            className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
          />
        </>
      )}

      {/* Submit Button */}
      <div className="text-center">
        <ButtonWithSpinner type="submit" loading={loading}>
          {loading ? "Signing Up..." : "Sign Up"}
        </ButtonWithSpinner>
      </div>

      {/* Links */}
      <aside>
        <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
          Already have an account?
          <a href="/login" className="text-white hover:underline font-bold ml-1">
            Log in
          </a>.
        </p>
      </aside>
    </form>
  );
}









// components/forms/SignupForm.tsx
//
// Purpose:
// - Signup form for both "individual" and "business" users.
// - Calls /api/auth/signup to create a user (and business if needed).
// - Uses role from API response to show personalized welcome toasts:
//   - BUSINESS_OWNER → 🎉 "Welcome Business Owner!"
//   - USER → 🎉 "Welcome aboard!"
// - Then auto-logs the user in with NextAuth.
//
// Requirements:
// - react-hot-toast installed
// - Global <Toaster /> in layout.tsx for consistent branding

// 'use client';

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

//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // --- Handle signup submission ---
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     try {
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

//       if (!response.ok) {
//         toast.error(data.error || "Signup failed. Please try again.");
//         setLoading(false);
//         return;
//       }

//       // ✅ Personalized role-based welcome toast
//       if (data.role === "BUSINESS_OWNER") {
//         toast.success("🎉 Welcome Business Owner! Your dashboard is ready.");
//       } else {
//         toast.success("🎉 Welcome aboard! Glad to have you here.");
//       }

//       // Auto-login with NextAuth (Credentials provider)
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
//         <button
//           type="submit"
//           disabled={loading}
//           className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-4xl shadow-2xl border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
//         >
//           {loading ? "Signing Up..." : "Sign Up"}
//         </button>
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









// components/forms/SignupForm.tsx
//
// Purpose:
// - Handles user signup (individual + business accounts).
// - Uses toast notifications for success/error instead of inline messages.
// - Automatically logs user in after signup (NextAuth credentials).
//
// Requirements:
// - react-hot-toast installed (`npm install react-hot-toast`)
// - <Toaster /> must be placed in app/layout.tsx (already added earlier)

// 'use client';

// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";
// import toast from "react-hot-toast"; // ✅ Toast notifications

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

//   // --- Loading state ---
//   const [loading, setLoading] = useState(false);

//   // Toggle password visibility
//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // --- Handle signup ---
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     console.log("📨 [SignupForm] Submitting with data:", {
//       name,
//       email,
//       password,
//       userType,
//       businessName: userType === "business" ? businessName : undefined,
//     });

//     try {
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

//       console.log("📨 [SignupForm] Raw response:", response);
//       const data = await response.json();
//       console.log("📨 [SignupForm] Parsed JSON:", data);

//       if (!response.ok) {
//         toast.error(data.error || "Signup failed. Please try again.");
//         setLoading(false);
//         return;
//       }

//       toast.success("Signup successful! Logging you in...");

//       // Auto-login with NextAuth
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

//       {/* Business Name (only shown if Business selected) */}
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
//         <button
//           type="submit"
//           disabled={loading}
//           className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-4xl shadow-2xl border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
//         >
//           {loading ? "Signing Up..." : "Sign Up"}
//         </button>
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









// 'use client';

// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";

// interface SignupFormProps {
//   redirectTo?: string; // optional redirect after signup
// }

// export default function SignupForm({ redirectTo }: SignupFormProps) {
//   // --- Local state for form fields ---
//   const [showPassword, setShowPassword] = useState(false);
//   const [userType, setUserType] = useState<"individual" | "business">("individual");
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [businessName, setBusinessName] = useState("");

//   // --- Local state for feedback ---
//   const [loading, setLoading] = useState(false);
//   const [errorMsg, setErrorMsg] = useState<string | null>(null);

//   // Toggle password visibility
//   const togglePasswordVisibility = () => setShowPassword(prev => !prev);

//   // --- Handle form submission ---
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);
//     setErrorMsg(null);

//     // ✅ Debug: log the request payload
//     console.log("📨 Submitting signup form with data:", {
//       name,
//       email,
//       password,
//       userType,
//       businessName: userType === "business" ? businessName : undefined,
//     });

//     try {
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

//       // ✅ Debug: log raw fetch response
//       console.log("📨 Raw response object:", response);

//       const data = await response.json();

//       // ✅ Debug: log parsed JSON
//       console.log("📨 Parsed response JSON:", data);

//       if (!response.ok) {
//         setErrorMsg(data.error || "Signup failed. Please try again.");
//         setLoading(false);
//         return;
//       }

//       console.log("✅ Signup successful, attempting auto-login...");

//       await signIn("credentials", {
//         email,
//         password,
//         redirect: true,
//         callbackUrl: redirectTo || "/dashboard",
//       });
//     } catch (err) {
//       console.error("❌ Signup error in handleSubmit:", err);
//       setErrorMsg("Something went wrong. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

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
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3
//           focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
//           bg-transparent text-white placeholder-white"
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
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3
//           focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
//           bg-transparent text-white placeholder-white"
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
//           className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20
//             focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
//             bg-transparent text-white placeholder-white"
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
//             className="block w-full border-white border-2 rounded-2xl px-4 py-3
//               focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
//               bg-transparent text-white placeholder-white"
//           />
//         </>
//       )}

//       {/* Error message */}
//       {errorMsg && (
//         <p className="text-red-400 text-sm text-center">{errorMsg}</p>
//       )}

//       {/* Submit Button */}
//       <div className="text-center">
//         <button
//           type="submit"
//           disabled={loading}
//           className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-4xl shadow-2xl
//             border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer
//             disabled:opacity-50 disabled:cursor-not-allowed"
//         >
//           {loading ? "Signing Up..." : "Sign Up"}
//         </button>
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




// // 'use client';

// // import { useState, FormEvent } from "react";
// // import { signIn } from "next-auth/react";

// // interface SignupFormProps {
// //   redirectTo?: string; // optional: where to go after signup
// // }

// // export default function SignupForm({ redirectTo }: SignupFormProps) {
// //   // --- Local state for form fields ---
// //   const [showPassword, setShowPassword] = useState<boolean>(false);
// //   const [userType, setUserType] = useState<"individual" | "business">("individual");
// //   const [name, setName] = useState("");
// //   const [email, setEmail] = useState("");
// //   const [password, setPassword] = useState("");
// //   const [businessName, setBusinessName] = useState("");

// //   // --- Feedback state ---
// //   const [loading, setLoading] = useState(false);
// //   const [errorMsg, setErrorMsg] = useState<string | null>(null);

// //   // Toggle password visibility
// //   const togglePasswordVisibility = () => setShowPassword(prev => !prev);

// //   // --- Handle form submission ---
// //   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
// //     e.preventDefault();
// //     setLoading(true);
// //     setErrorMsg(null);

// //     try {
// //       // 1️⃣ Call the backend signup API (creates User in DB)
// //       const response = await fetch("/api/auth/signup", {
// //         method: "POST",
// //         headers: { "Content-Type": "application/json" },
// //         body: JSON.stringify({
// //           name,
// //           email,
// //           password,
// //           userType,
// //           // Only send businessName if user is signing up as business
// //           businessName: userType === "business" ? businessName : undefined,
// //         }),
// //       });

// //       const data = await response.json();

// //       // 2️⃣ Handle backend errors
// //       if (!response.ok) {
// //         setErrorMsg(data.error || "Signup failed. Please try again.");
// //         setLoading(false);
// //         return;
// //       }

// //       // 3️⃣ Auto-login with NextAuth CredentialsProvider
// //       const result = await signIn("credentials", {
// //         email,
// //         password,
// //         redirect: true, // Let NextAuth handle the redirect
// //         callbackUrl: redirectTo || "/dashboard", // Default = dashboard
// //       });

// //       if (!result?.ok) {
// //         setErrorMsg("Login failed after signup. Please try logging in manually.");
// //       }
// //     } catch (err) {
// //       console.error("❌ Signup error:", err);
// //       setErrorMsg("Something went wrong. Please try again.");
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   return (
// //     <form
// //       onSubmit={handleSubmit}
// //       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
// //     >
// //       {/* Name */}
// //       <label htmlFor="name" className="text-left text-white font-bold text-sm md:text-base">
// //         Name
// //       </label>
// //       <input
// //         type="text"
// //         id="name"
// //         value={name}
// //         onChange={(e) => setName(e.target.value)}
// //         required
// //         placeholder="Your full name"
// //         className="block w-full border-white border-2 rounded-2xl px-4 py-3
// //           focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
// //           bg-transparent text-white placeholder-white"
// //       />

// //       {/* Email */}
// //       <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
// //         Email
// //       </label>
// //       <input
// //         type="email"
// //         id="email"
// //         value={email}
// //         onChange={(e) => setEmail(e.target.value)}
// //         required
// //         placeholder="you@example.com"
// //         className="block w-full border-white border-2 rounded-2xl px-4 py-3
// //           focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
// //           bg-transparent text-white placeholder-white"
// //       />

// //       {/* Password */}
// //       <label htmlFor="password" className="text-left text-white font-bold text-sm md:text-base">
// //         Password
// //       </label>
// //       <div className="relative">
// //         <input
// //           type={showPassword ? "text" : "password"}
// //           id="password"
// //           value={password}
// //           onChange={(e) => setPassword(e.target.value)}
// //           required
// //           placeholder="Enter your password"
// //           className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20
// //             focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
// //             bg-transparent text-white placeholder-white"
// //         />
// //         <button
// //           type="button"
// //           onClick={togglePasswordVisibility}
// //           className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none"
// //           tabIndex={-1}
// //         >
// //           {showPassword ? "Hide" : "Show"}
// //         </button>
// //       </div>

// //       {/* User Type Selection */}
// //       <fieldset className="mt-4 pt-4">
// //         <legend className="text-white font-bold text-sm md:text-base mb-2">
// //           I am signing up as:
// //         </legend>
// //         <label className="flex items-center gap-2 text-white">
// //           <input
// //             type="radio"
// //             name="userType"
// //             value="individual"
// //             checked={userType === "individual"}
// //             onChange={() => setUserType("individual")}
// //             className="accent-green-500"
// //           />
// //           Individual
// //         </label>
// //         <label className="flex items-center gap-2 text-white">
// //           <input
// //             type="radio"
// //             name="userType"
// //             value="business"
// //             checked={userType === "business"}
// //             onChange={() => setUserType("business")}
// //             className="accent-green-500"
// //           />
// //           Business
// //         </label>
// //       </fieldset>

// //       {/* Business Name (only shown if user selects Business) */}
// //       {userType === "business" && (
// //         <>
// //           <label htmlFor="businessName" className="text-left text-white font-bold text-sm md:text-base">
// //             Business Name
// //           </label>
// //           <input
// //             type="text"
// //             id="businessName"
// //             value={businessName}
// //             onChange={(e) => setBusinessName(e.target.value)}
// //             required={userType === "business"}
// //             placeholder="Your company name"
// //             className="block w-full border-white border-2 rounded-2xl px-4 py-3
// //               focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
// //               bg-transparent text-white placeholder-white"
// //           />
// //         </>
// //       )}

// //       {/* Error message */}
// //       {errorMsg && (
// //         <p className="text-red-400 text-sm text-center">{errorMsg}</p>
// //       )}

// //       {/* Submit Button */}
// //       <div className="text-center">
// //         <button
// //           type="submit"
// //           disabled={loading}
// //           className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-4xl shadow-2xl
// //             border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer
// //             disabled:opacity-50 disabled:cursor-not-allowed"
// //         >
// //           {loading ? "Signing Up..." : "Sign Up"}
// //         </button>
// //       </div>

// //       {/* Links */}
// //       <aside>
// //         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
// //           Already have an account?
// //           <a href="/login" className="text-white hover:underline font-bold ml-1">
// //             Log in
// //           </a>.
// //         </p>
// //       </aside>
// //     </form>
// //   );
// // }








// // 'use client';

// // import { useState, FormEvent } from "react";
// // import { signIn } from "next-auth/react";

// // interface SignupFormProps {
// //   redirectTo?: string; // optional redirect after signup
// // }

// // export default function SignupForm({ redirectTo }: SignupFormProps) {
// //   // --- Local state for form fields ---
// //   const [showPassword, setShowPassword] = useState<boolean>(false);
// //   const [userType, setUserType] = useState<"individual" | "business">("individual");
// //   const [name, setName] = useState("");
// //   const [email, setEmail] = useState("");
// //   const [password, setPassword] = useState("");
// //   const [businessName, setBusinessName] = useState("");

// //   // --- Local state for feedback ---
// //   const [loading, setLoading] = useState(false);
// //   const [errorMsg, setErrorMsg] = useState<string | null>(null);

// //   // Toggle password visibility
// //   const togglePasswordVisibility = () => setShowPassword(prev => !prev);

// //   // --- Handle form submission ---
// //   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
// //     e.preventDefault();
// //     setLoading(true);
// //     setErrorMsg(null);

// //     try {
// //       // 1️ Send signup request to backend route
// //       const response = await fetch("/api/auth/signup", {
// //         method: "POST",
// //         headers: { "Content-Type": "application/json" },
// //         body: JSON.stringify({
// //           name,
// //           email,
// //           password,
// //           userType,
// //           businessName: userType === "business" ? businessName : undefined,
// //         }),
// //       });

// //       const data = await response.json();

// //       if (!response.ok) {
// //         setErrorMsg(data.error || "Signup failed. Please try again.");
// //         setLoading(false);
// //         return;
// //       }

// //       // 2️ Auto-login after successful signup
// //       //    This uses NextAuth's CredentialsProvider
// //       await signIn("credentials", {
// //         email,
// //         password,
// //         redirect: true, // allow redirect after login
// //         callbackUrl: redirectTo || "/dashboard", // send user to dashboard
// //       });
// //     } catch (err) {
// //       console.error("Signup error:", err);
// //       setErrorMsg("Something went wrong. Please try again.");
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   return (
// //     <form
// //       onSubmit={handleSubmit}
// //       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
// //     >
// //       {/* Name */}
// //       <label htmlFor="name" className="text-left text-white font-bold text-sm md:text-base">
// //         Name
// //       </label>
// //       <input
// //         type="text"
// //         id="name"
// //         value={name}
// //         onChange={(e) => setName(e.target.value)}
// //         required
// //         placeholder="Your full name"
// //         className="block w-full border-white border-2 rounded-2xl px-4 py-3
// //           focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
// //           bg-transparent text-white placeholder-white"
// //       />

// //       {/* Email */}
// //       <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
// //         Email
// //       </label>
// //       <input
// //         type="email"
// //         id="email"
// //         value={email}
// //         onChange={(e) => setEmail(e.target.value)}
// //         required
// //         placeholder="you@example.com"
// //         className="block w-full border-white border-2 rounded-2xl px-4 py-3
// //           focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
// //           bg-transparent text-white placeholder-white"
// //       />

// //       {/* Password */}
// //       <label htmlFor="password" className="text-left text-white font-bold text-sm md:text-base">
// //         Password
// //       </label>
// //       <div className="relative">
// //         <input
// //           type={showPassword ? "text" : "password"}
// //           id="password"
// //           value={password}
// //           onChange={(e) => setPassword(e.target.value)}
// //           required
// //           placeholder="Enter your password"
// //           className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20
// //             focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
// //             bg-transparent text-white placeholder-white"
// //         />
// //         <button
// //           type="button"
// //           onClick={togglePasswordVisibility}
// //           className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none"
// //           tabIndex={-1}
// //         >
// //           {showPassword ? "Hide" : "Show"}
// //         </button>
// //       </div>

// //       {/* User Type Selection */}
// //       <fieldset className="mt-4 pt-4">
// //         <legend className="text-white font-bold text-sm md:text-base mb-2">
// //           I am signing up as:
// //         </legend>
// //         <label className="flex items-center gap-2 text-white">
// //           <input
// //             type="radio"
// //             name="userType"
// //             value="individual"
// //             checked={userType === "individual"}
// //             onChange={() => setUserType("individual")}
// //             className="accent-green-500"
// //           />
// //           Individual
// //         </label>
// //         <label className="flex items-center gap-2 text-white">
// //           <input
// //             type="radio"
// //             name="userType"
// //             value="business"
// //             checked={userType === "business"}
// //             onChange={() => setUserType("business")}
// //             className="accent-green-500"
// //           />
// //           Business
// //         </label>
// //       </fieldset>

// //       {/* Business Name (only shown if Business is selected) */}
// //       {userType === "business" && (
// //         <>
// //           <label htmlFor="businessName" className="text-left text-white font-bold text-sm md:text-base">
// //             Business Name
// //           </label>
// //           <input
// //             type="text"
// //             id="businessName"
// //             value={businessName}
// //             onChange={(e) => setBusinessName(e.target.value)}
// //             required={userType === "business"}
// //             placeholder="Your company name"
// //             className="block w-full border-white border-2 rounded-2xl px-4 py-3
// //               focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
// //               bg-transparent text-white placeholder-white"
// //           />
// //         </>
// //       )}

// //       {/* Error message */}
// //       {errorMsg && (
// //         <p className="text-red-400 text-sm text-center">{errorMsg}</p>
// //       )}

// //       {/* Signup Button */}
// //       <div className="text-center">
// //         <button
// //           type="submit"
// //           disabled={loading}
// //           className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-4xl shadow-2xl
// //             border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer
// //             disabled:opacity-50 disabled:cursor-not-allowed"
// //         >
// //           {loading ? "Signing Up..." : "Sign Up"}
// //         </button>
// //       </div>

// //       {/* Links */}
// //       <aside>
// //         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
// //           Already have an account?
// //           <a href="/login" className="text-white hover:underline font-bold ml-1">
// //             Log in
// //           </a>.
// //         </p>
// //       </aside>
// //     </form>
// //   );
// // }




















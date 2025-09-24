'use client';

import ButtonWithSpinner from "../ui/buttonWithSpinner";
import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { emailRegex, suggestDomain } from "@/utils/emailValidation";
import {
  showRoleToast,
  showRoleErrorToast,
  showSystemErrorToast,
} from "@/lib/toastMessages";

interface SignupFormProps {
  redirectTo?: string;
}

export default function SignupForm({ redirectTo }: SignupFormProps) {
  // ------------------------------
  // State
  // ------------------------------
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState<"individual" | "business">("individual");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  // ------------------------------
  // Handle signup
  // ------------------------------
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      // --------------------------
      // 1. Call signup API
      // --------------------------
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
        // Distinguish system vs validation errors
        if (data?.systemError) {
          showSystemErrorToast();
        } else {
          showRoleErrorToast("USER");
        }
        setLoading(false);
        return;
      }

      // --------------------------
      // 2. Success toast
      // --------------------------
      showRoleToast(data.role);

      // --------------------------
      // 3. Auto-login immediately
      // --------------------------
      const loginResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (loginResult?.error) {
        // Parse error string/JSON like in LoginForm
        try {
          const parsedError = JSON.parse(loginResult.error);
          if (parsedError?.systemError) {
            showSystemErrorToast();
          } else {
            showRoleErrorToast("USER");
          }
        } catch {
          if (loginResult.error === "Invalid credentials") {
            showRoleErrorToast("USER"); // wrong password/email
          } else {
            showSystemErrorToast(); // treat everything else as system failure
          }
        }
        setLoading(false);
        return;
      }

      // --------------------------
      // 4. Redirect on success
      // --------------------------
      setTimeout(() => {
        router.push(redirectTo || "/dashboard");
      }, 500);
    } catch (err) {
      console.error("❌ [SignupForm] Unexpected error:", err);
      showSystemErrorToast();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
    >
      {/* -------------------------
          Name
      ------------------------- */}
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

      {/* -------------------------
          Email
      ------------------------- */}
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
          ${emailRegex.test(email) ? "border-green-500" : "border-red-500"}`}
        autoComplete="email"
        inputMode="email"
      />
      {!emailRegex.test(email) && suggestDomain(email) && (
        <div className="flex items-center space-x-2 mt-1 text-yellow-400 text-sm">
          <span>
            Did you mean <strong>{suggestDomain(email)}</strong>?
          </span>
          <button
            type="button"
            onClick={() => setEmail(suggestDomain(email)!)}
            className="ml-2 px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
          >
            ✅ Use this
          </button>
        </div>
      )}

      {/* -------------------------
          Password
      ------------------------- */}
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

      {/* -------------------------
          User type
      ------------------------- */}
      <fieldset className="mt-4 pt-4">
        <legend className="text-white font-bold text-sm md:text-base mb-2">I am signing up as:</legend>
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

      {/* -------------------------
          Submit
      ------------------------- */}
      <div className="text-center">
        <ButtonWithSpinner type="submit" loading={loading}>
          {loading ? "Signing Up..." : "Sign Up"}
        </ButtonWithSpinner>
      </div>

      {/* -------------------------
          Footer
      ------------------------- */}
      <aside>
        <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
          Already have an account?
          <a href="/login" className="text-white hover:underline font-bold ml-1">
            Log in
          </a>
          .
        </p>
      </aside>
    </form>
  );
}









// 'use client';

// import ButtonWithSpinner from "../ui/buttonWithSpinner";
// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";
// import { useRouter } from "next/navigation";
// import { emailRegex, suggestDomain } from "@/utils/emailValidation";
// import {
//   showRoleToast,
//   showRoleErrorToast,
//   showSystemErrorToast,
// } from "@/lib/toastMessages";

// interface SignupFormProps {
//   redirectTo?: string;
// }

// export default function SignupForm({ redirectTo }: SignupFormProps) {
//   // ------------------------------
//   // State
//   // ------------------------------
//   const [showPassword, setShowPassword] = useState(false);
//   const [userType, setUserType] = useState<"individual" | "business">("individual");
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [businessName, setBusinessName] = useState("");
//   const [loading, setLoading] = useState(false);

//   const router = useRouter();
//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // ------------------------------
//   // Handle signup
//   // ------------------------------
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
//         // Distinguish error types
//         if (data?.systemError) {
//           showSystemErrorToast();
//         } else {
//           showRoleErrorToast("USER");
//         }
//         setLoading(false);
//         return;
//       }

//       // ✅ Role-aware success toast
//       showRoleToast(data.role);

//       // ✅ Auto-login immediately after signup
//       const loginResult = await signIn("credentials", {
//         email,
//         password,
//         redirect: false,
//       });

//       if (loginResult?.error) {
//         try {
//           const parsedError = JSON.parse(loginResult.error);
//           if (parsedError?.systemError) {
//             showSystemErrorToast();
//           } else {
//             showRoleErrorToast("USER");
//           }
//         } catch {
//           showRoleErrorToast("USER");
//         }
//         setLoading(false);
//         return;
//       }

//       // ✅ Smooth redirect
//       setTimeout(() => {
//         router.push(redirectTo || "/dashboard");
//       }, 500);
//     } catch (err) {
//       console.error("❌ [SignupForm] Unexpected error:", err);
//       showSystemErrorToast();
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
//       {/* -------------------------
//           Name
//       ------------------------- */}
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

//       {/* -------------------------
//           Email
//       ------------------------- */}
//       <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value.trim())}
//         required
//         placeholder="you@example.com"
//         className={`block w-full border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white
//           ${emailRegex.test(email) ? "border-green-500" : "border-red-500"}`}
//         autoComplete="email"
//         inputMode="email"
//       />
//       {!emailRegex.test(email) && suggestDomain(email) && (
//         <div className="flex items-center space-x-2 mt-1 text-yellow-400 text-sm">
//           <span>
//             Did you mean <strong>{suggestDomain(email)}</strong>?
//           </span>
//           <button
//             type="button"
//             onClick={() => setEmail(suggestDomain(email)!)}
//             className="ml-2 px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
//           >
//             ✅ Use this
//           </button>
//         </div>
//       )}

//       {/* -------------------------
//           Password
//       ------------------------- */}
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

//       {/* -------------------------
//           User type
//       ------------------------- */}
//       <fieldset className="mt-4 pt-4">
//         <legend className="text-white font-bold text-sm md:text-base mb-2">I am signing up as:</legend>
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

//       {/* -------------------------
//           Submit
//       ------------------------- */}
//       <div className="text-center">
//         <ButtonWithSpinner type="submit" loading={loading}>
//           {loading ? "Signing Up..." : "Sign Up"}
//         </ButtonWithSpinner>
//       </div>

//       {/* -------------------------
//           Footer
//       ------------------------- */}
//       <aside>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           Already have an account?
//           <a href="/login" className="text-white hover:underline font-bold ml-1">
//             Log in
//           </a>
//           .
//         </p>
//       </aside>
//     </form>
//   );
// }









// 'use client';

// import ButtonWithSpinner from "../ui/buttonWithSpinner";
// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";
// import { useRouter } from "next/navigation"; // ✅ smooth navigation
// import { emailRegex, suggestDomain } from "@/utils/emailValidation";
// import {
//   showRoleToast,
//   showRoleErrorToast,
//   showSystemErrorToast,
// } from "@/lib/toastMessages"; // ✅ success, error, system error

// interface SignupFormProps {
//   redirectTo?: string;
// }

// export default function SignupForm({ redirectTo }: SignupFormProps) {
//   // ------------------------------
//   // State variables
//   // ------------------------------
//   const [showPassword, setShowPassword] = useState(false);
//   const [userType, setUserType] = useState<"individual" | "business">("individual");
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [businessName, setBusinessName] = useState("");
//   const [loading, setLoading] = useState(false);

//   const router = useRouter();

//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // ------------------------------
//   // Handle signup
//   // ------------------------------
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
//         // --------------------------
//         // Distinguish between system errors vs user errors
//         // --------------------------
//         if (data?.systemError) {
//           // Purple toast (server-side unexpected failure)
//           showSystemErrorToast();
//         } else {
//           // Role-aware error toast (validation / duplicate user, etc.)
//           showRoleErrorToast("USER");
//         }
//         setLoading(false);
//         return;
//       }

//       // ✅ Role-aware success toast
//       showRoleToast(data.role);

//       // ✅ Auto-login
//       await signIn("credentials", {
//         email,
//         password,
//         redirect: false,
//       });

//       // ✅ Smooth redirect
//       setTimeout(() => {
//         router.push(redirectTo || "/dashboard");
//       }, 500);
//     } catch (err) {
//       console.error("❌ [SignupForm] Unexpected error:", err);
//       // System-level error (network/server down)
//       showSystemErrorToast();
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
//       {/* -------------------------
//           Name
//       ------------------------- */}
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

//       {/* -------------------------
//           Email
//       ------------------------- */}
//       <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value.trim())}
//         required
//         placeholder="you@example.com"
//         className={`block w-full border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white
//           ${emailRegex.test(email) ? "border-green-500" : "border-red-500"}`}
//         autoComplete="email"
//         inputMode="email"
//       />
//       {/* ✅ Suggest email correction */}
//       {!emailRegex.test(email) && suggestDomain(email) && (
//         <div className="flex items-center space-x-2 mt-1 text-yellow-400 text-sm">
//           <span>
//             Did you mean <strong>{suggestDomain(email)}</strong>?
//           </span>
//           <button
//             type="button"
//             onClick={() => setEmail(suggestDomain(email)!)}
//             className="ml-2 px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
//           >
//             ✅ Use this
//           </button>
//         </div>
//       )}

//       {/* -------------------------
//           Password
//       ------------------------- */}
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

//       {/* -------------------------
//           User type
//       ------------------------- */}
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

//       {/* -------------------------
//           Business name (if selected)
//       ------------------------- */}
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

//       {/* -------------------------
//           Submit button
//       ------------------------- */}
//       <div className="text-center">
//         <ButtonWithSpinner type="submit" loading={loading}>
//           {loading ? "Signing Up..." : "Sign Up"}
//         </ButtonWithSpinner>
//       </div>

//       {/* -------------------------
//           Footer link
//       ------------------------- */}
//       <aside>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           Already have an account?
//           <a href="/login" className="text-white hover:underline font-bold ml-1">
//             Log in
//           </a>
//           .
//         </p>
//       </aside>
//     </form>
//   );
// }









// 'use client';

// import ButtonWithSpinner from "../ui/buttonWithSpinner";
// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";
// import { useRouter } from "next/navigation"; // ✅ smooth navigation
// import { emailRegex, suggestDomain } from "@/utils/emailValidation";
// import {
//   showRoleToast,
//   showRoleErrorToast,
//   showSystemErrorToast,
// } from "@/lib/toastMessages"; // ✅ success, error, system error

// interface SignupFormProps {
//   redirectTo?: string;
// }

// export default function SignupForm({ redirectTo }: SignupFormProps) {
//   // ------------------------------
//   // State variables
//   // ------------------------------
//   const [showPassword, setShowPassword] = useState(false);
//   const [userType, setUserType] = useState<"individual" | "business">("individual");
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [businessName, setBusinessName] = useState("");
//   const [loading, setLoading] = useState(false);

//   const router = useRouter();

//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // ------------------------------
//   // Handle signup
//   // ------------------------------
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
//         // Role-aware error toast
//         showRoleErrorToast("USER");
//         setLoading(false);
//         return;
//       }

//       // ✅ Role-aware success toast
//       showRoleToast(data.role);

//       // ✅ Auto-login
//       await signIn("credentials", {
//         email,
//         password,
//         redirect: false,
//       });

//       // ✅ Smooth redirect
//       setTimeout(() => {
//         router.push(redirectTo || "/dashboard");
//       }, 500);
//     } catch (err) {
//       console.error("❌ [SignupForm] Unexpected error:", err);
//       // System-level error
//       showSystemErrorToast();
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
//       {/* -------------------------
//           Name
//       ------------------------- */}
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

//       {/* -------------------------
//           Email
//       ------------------------- */}
//       <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value.trim())}
//         required
//         placeholder="you@example.com"
//         className={`block w-full border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white
//           ${emailRegex.test(email) ? "border-green-500" : "border-red-500"}`}
//         autoComplete="email"
//         inputMode="email"
//       />
//       {/* ✅ Suggest email correction */}
//       {!emailRegex.test(email) && suggestDomain(email) && (
//         <div className="flex items-center space-x-2 mt-1 text-yellow-400 text-sm">
//           <span>
//             Did you mean <strong>{suggestDomain(email)}</strong>?
//           </span>
//           <button
//             type="button"
//             onClick={() => setEmail(suggestDomain(email)!)}
//             className="ml-2 px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
//           >
//             ✅ Use this
//           </button>
//         </div>
//       )}

//       {/* -------------------------
//           Password
//       ------------------------- */}
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

//       {/* -------------------------
//           User type
//       ------------------------- */}
//       <fieldset className="mt-4 pt-4">
//         <legend className="text-white font-bold text-sm md:text-base mb-2">I am signing up as:</legend>
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

//       {/* -------------------------
//           Business name (if selected)
//       ------------------------- */}
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

//       {/* -------------------------
//           Submit button
//       ------------------------- */}
//       <div className="text-center">
//         <ButtonWithSpinner type="submit" loading={loading}>
//           {loading ? "Signing Up..." : "Sign Up"}
//         </ButtonWithSpinner>
//       </div>

//       {/* -------------------------
//           Footer link
//       ------------------------- */}
//       <aside>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           Already have an account?
//           <a href="/login" className="text-white hover:underline font-bold ml-1">
//             Log in
//           </a>
//           .
//         </p>
//       </aside>
//     </form>
//   );
// }









// 'use client';

// import ButtonWithSpinner from "../ui/buttonWithSpinner";
// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";
// import { useRouter } from "next/navigation"; // ✅ router for navigation
// import { emailRegex, suggestDomain } from "@/utils/emailValidation";
// import { showRoleToast, showRoleErrorToast } from "@/lib/toastMessages"; // ✅ success + error toast helpers

// interface SignupFormProps {
//   redirectTo?: string;
// }

// export default function SignupForm({ redirectTo }: SignupFormProps) {
//   // ------------------------------
//   // State variables for form fields
//   // ------------------------------
//   const [showPassword, setShowPassword] = useState(false); // toggle password visibility
//   const [userType, setUserType] = useState<"individual" | "business">("individual");
//   const [name, setName] = useState(""); // full name
//   const [email, setEmail] = useState(""); // email
//   const [password, setPassword] = useState(""); // temporary, backend hashes it
//   const [businessName, setBusinessName] = useState(""); // only for business users
//   const [loading, setLoading] = useState(false); // loading state

//   const router = useRouter();

//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // ------------------------------
//   // Handle form submission
//   // ------------------------------
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     try {
//       // ✅ Call signup API
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
//         // ------------------------
//         // Role-aware error toast
//         // ------------------------
//         // API may not return role → fallback to "USER"
//         showRoleErrorToast("USER");
//         setLoading(false);
//         return;
//       }

//       // ------------------------
//       // Role-aware success toast
//       // ------------------------
//       showRoleToast(data.role);

//       // ✅ Auto login after signup
//       await signIn("credentials", {
//         email,
//         password,
//         redirect: false, // disable auto redirect
//       });

//       // ✅ Smooth redirect
//       setTimeout(() => {
//         router.push(redirectTo || "/dashboard");
//       }, 500);
//     } catch (err) {
//       console.error("❌ [SignupForm] Unexpected error:", err);
//       showRoleErrorToast("USER");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
//       {/* -------------------------
//           Name
//       ------------------------- */}
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

//       {/* -------------------------
//           Email
//       ------------------------- */}
//       <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value.trim())}
//         required
//         placeholder="you@example.com"
//         className={`block w-full border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white
//           ${emailRegex.test(email) ? "border-green-500" : "border-red-500"}`}
//         autoComplete="email"
//         inputMode="email"
//       />
//       {/* ✅ Suggest email domain correction */}
//       {!emailRegex.test(email) && suggestDomain(email) && (
//         <div className="flex items-center space-x-2 mt-1 text-yellow-400 text-sm">
//           <span>
//             Did you mean <strong>{suggestDomain(email)}</strong>?
//           </span>
//           <button
//             type="button"
//             onClick={() => setEmail(suggestDomain(email)!)}
//             className="ml-2 px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
//           >
//             ✅ Use this
//           </button>
//         </div>
//       )}

//       {/* -------------------------
//           Password
//       ------------------------- */}
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
//         {/* ✅ Show/Hide toggle */}
//         <button
//           type="button"
//           onClick={togglePasswordVisibility}
//           className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none"
//           tabIndex={-1}
//         >
//           {showPassword ? "Hide" : "Show"}
//         </button>
//       </div>

//       {/* -------------------------
//           User type selection
//       ------------------------- */}
//       <fieldset className="mt-4 pt-4">
//         <legend className="text-white font-bold text-sm md:text-base mb-2">I am signing up as:</legend>
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

//       {/* -------------------------
//           Business name (if Business selected)
//       ------------------------- */}
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

//       {/* -------------------------
//           Submit button
//       ------------------------- */}
//       <div className="text-center">
//         <ButtonWithSpinner type="submit" loading={loading}>
//           {loading ? "Signing Up..." : "Sign Up"}
//         </ButtonWithSpinner>
//       </div>

//       {/* -------------------------
//           Footer links
//       ------------------------- */}
//       <aside>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           Already have an account?
//           <a href="/login" className="text-white hover:underline font-bold ml-1">
//             Log in
//           </a>
//           .
//         </p>
//       </aside>
//     </form>
//   );
// }









// 'use client';

// import ButtonWithSpinner from "../ui/buttonWithSpinner";
// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";
// import { useRouter } from "next/navigation"; // ✅ use router for navigation
// import toast from "react-hot-toast";
// import { emailRegex, suggestDomain } from "@/utils/emailValidation";
// import { showRoleToast } from "@/lib/toastMessages"; // ✅ role-aware toast helper

// interface SignupFormProps {
//   redirectTo?: string;
// }

// export default function SignupForm({ redirectTo }: SignupFormProps) {
//   // ------------------------------
//   // State variables for form fields
//   // ------------------------------
//   const [showPassword, setShowPassword] = useState(false); // toggle password visibility
//   const [userType, setUserType] = useState<"individual" | "business">("individual");
//   const [name, setName] = useState(""); // full name
//   const [email, setEmail] = useState(""); // email
//   const [password, setPassword] = useState(""); // temporary, backend hashes it
//   const [businessName, setBusinessName] = useState(""); // only for business users
//   const [loading, setLoading] = useState(false); // loading state

//   const router = useRouter(); // ✅ Next.js router for smooth navigation

//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // ------------------------------
//   // Handle form submission
//   // ------------------------------
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     try {
//       // ✅ Call signup API
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
//         toast.error(data.error || "Signup failed. Please try again.", { duration: 6000 });
//         setLoading(false);
//         return;
//       }

//       // ✅ Show personalized toast based on role
//       showRoleToast(data.role);

//       // ✅ Auto login after signup
//       await signIn("credentials", {
//         email,
//         password,
//         redirect: false, // disable auto redirect
//       });

//       // ✅ Smooth redirect so toast stays visible
//       setTimeout(() => {
//         router.push(redirectTo || "/dashboard");
//       }, 500);
//     } catch (err) {
//       console.error("❌ [SignupForm] Unexpected error:", err);
//       toast.error("Something went wrong. Please try again.", { duration: 6000 });
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
//       {/* -------------------------
//           Name
//       ------------------------- */}
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

//       {/* -------------------------
//           Email
//       ------------------------- */}
//       <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value.trim())}
//         required
//         placeholder="you@example.com"
//         className={`block w-full border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white
//           ${emailRegex.test(email) ? "border-green-500" : "border-red-500"}`}
//         autoComplete="email"
//         inputMode="email"
//       />
//       {/* ✅ Suggest email domain correction */}
//       {!emailRegex.test(email) && suggestDomain(email) && (
//         <div className="flex items-center space-x-2 mt-1 text-yellow-400 text-sm">
//           <span>
//             Did you mean <strong>{suggestDomain(email)}</strong>?
//           </span>
//           <button
//             type="button"
//             onClick={() => setEmail(suggestDomain(email)!)}
//             className="ml-2 px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
//           >
//             ✅ Use this
//           </button>
//         </div>
//       )}

//       {/* -------------------------
//           Password
//       ------------------------- */}
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
//         {/* ✅ Show/Hide toggle */}
//         <button
//           type="button"
//           onClick={togglePasswordVisibility}
//           className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none"
//           tabIndex={-1}
//         >
//           {showPassword ? "Hide" : "Show"}
//         </button>
//       </div>

//       {/* -------------------------
//           User type selection
//       ------------------------- */}
//       <fieldset className="mt-4 pt-4">
//         <legend className="text-white font-bold text-sm md:text-base mb-2">I am signing up as:</legend>
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

//       {/* -------------------------
//           Business name (if Business selected)
//       ------------------------- */}
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

//       {/* -------------------------
//           Submit button
//       ------------------------- */}
//       <div className="text-center">
//         <ButtonWithSpinner type="submit" loading={loading}>
//           {loading ? "Signing Up..." : "Sign Up"}
//         </ButtonWithSpinner>
//       </div>

//       {/* -------------------------
//           Footer links
//       ------------------------- */}
//       <aside>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           Already have an account?
//           <a href="/login" className="text-white hover:underline font-bold ml-1">
//             Log in
//           </a>
//           .
//         </p>
//       </aside>
//     </form>
//   );
// }









// 'use client';

// import ButtonWithSpinner from "../ui/buttonWithSpinner";
// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";
// import toast from "react-hot-toast";
// import { emailRegex, suggestDomain } from "@/utils/emailValidation";
// import { showRoleToast } from "@/lib/toastMessages"; // ✅ role-aware toast helper

// interface SignupFormProps {
//   redirectTo?: string;
// }

// export default function SignupForm({ redirectTo }: SignupFormProps) {
//   // ------------------------------
//   // State variables for form fields
//   // ------------------------------
//   const [showPassword, setShowPassword] = useState(false);
//   const [userType, setUserType] = useState<"individual" | "business">("individual");
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState(""); // ✅ stored temporarily, backend hashes it
//   const [businessName, setBusinessName] = useState("");
//   const [loading, setLoading] = useState(false);

//   // Toggle password visibility
//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // ------------------------------
//   // Handle form submission
//   // ------------------------------
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     try {
//       // ✅ Call signup API
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

//       // ✅ Show personalized toast based on role
//       showRoleToast(data.role);

//       // ✅ Automatically log the user in after signup
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
//       {/* -------------------------
//           Name
//       ------------------------- */}
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

//       {/* -------------------------
//           Email
//       ------------------------- */}
//       <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value.trim())}
//         required
//         placeholder="you@example.com"
//         className={`block w-full border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white
//           ${emailRegex.test(email) ? "border-green-500" : "border-red-500"}`}
//         autoComplete="email"
//         inputMode="email"
//       />
//       {/* ✅ Suggest email domain correction */}
//       {!emailRegex.test(email) && suggestDomain(email) && (
//         <div className="flex items-center space-x-2 mt-1 text-yellow-400 text-sm">
//           <span>
//             Did you mean <strong>{suggestDomain(email)}</strong>?
//           </span>
//           <button
//             type="button"
//             onClick={() => setEmail(suggestDomain(email)!)}
//             className="ml-2 px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
//           >
//             ✅ Use this
//           </button>
//         </div>
//       )}

//       {/* -------------------------
//           Password
//       ------------------------- */}
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
//         {/* ✅ Show/Hide toggle */}
//         <button
//           type="button"
//           onClick={togglePasswordVisibility}
//           className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none"
//           tabIndex={-1}
//         >
//           {showPassword ? "Hide" : "Show"}
//         </button>
//       </div>

//       {/* -------------------------
//           User type selection
//       ------------------------- */}
//       <fieldset className="mt-4 pt-4">
//         <legend className="text-white font-bold text-sm md:text-base mb-2">I am signing up as:</legend>
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

//       {/* -------------------------
//           Business name (if Business selected)
//       ------------------------- */}
//       {userType === "business" && (
//         <>
//           <label
//             htmlFor="businessName"
//             className="text-left text-white font-bold text-sm md:text-base"
//           >
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

//       {/* -------------------------
//           Submit button
//       ------------------------- */}
//       <div className="text-center">
//         <ButtonWithSpinner type="submit" loading={loading}>
//           {loading ? "Signing Up..." : "Sign Up"}
//         </ButtonWithSpinner>
//       </div>

//       {/* -------------------------
//           Footer links
//       ------------------------- */}
//       <aside>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           Already have an account?
//           <a href="/login" className="text-white hover:underline font-bold ml-1">
//             Log in
//           </a>
//           .
//         </p>
//       </aside>
//     </form>
//   );
// }










// 'use client';

// import ButtonWithSpinner from "../ui/buttonWithSpinner"; 
// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";
// import toast from "react-hot-toast";
// import { emailRegex, suggestDomain } from "@/utils/emailValidation";

// interface SignupFormProps {
//   redirectTo?: string;
// }

// export default function SignupForm({ redirectTo }: SignupFormProps) {
//   // --- Form state ---
//   const [showPassword, setShowPassword] = useState(false);
//   const [userType, setUserType] = useState<"individual" | "business">("individual");
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState(""); // ✅ Plaintext password (hashed securely on backend)
//   const [businessName, setBusinessName] = useState("");
//   const [loading, setLoading] = useState(false);

//   // Toggle password visibility
//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // --- Handle signup submission ---
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     try {
//       // ✅ Send plaintext password here
//       // Backend API will hash it into hashedPassword before saving
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

//       // ✅ Friendly toast based on role
//       if (data.role === "BUSINESS_OWNER") {
//         toast.success("🎉 Welcome Business Owner! Your dashboard is ready.");
//       } else {
//         toast.success("🎉 Welcome aboard! Glad to have you here.");
//       }

//       // ✅ Auto-login new user after signup
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
//         onChange={(e) => setEmail(e.target.value.trim())}
//         required
//         placeholder="you@example.com"
//         className={`block w-full border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white
//           ${emailRegex.test(email) ? 'border-green-500' : 'border-red-500'}`}
//         autoComplete="email"
//         inputMode="email"
//       />
//       {!emailRegex.test(email) && suggestDomain(email) && (
//         <div className="flex items-center space-x-2 mt-1 text-yellow-400 text-sm">
//           <span>Did you mean <strong>{suggestDomain(email)}</strong>?</span>
//           <button
//             type="button"
//             onClick={() => setEmail(suggestDomain(email)!)}
//             className="ml-2 px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
//           >
//             ✅ Use this
//           </button>
//         </div>
//       )}

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

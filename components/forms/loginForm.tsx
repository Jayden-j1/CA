'use client';

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation"; // ✅ smooth navigation
import {
  showRoleToast,
  showRoleErrorToast,
  showSystemErrorToast,
} from "@/lib/toastMessages"; // ✅ success, role error, system error

export default function LoginForm() {
  // ------------------------------
  // State variables
  // ------------------------------
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  // ------------------------------
  // Handle login submission
  // ------------------------------
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      // ✅ Attempt login with NextAuth credentials provider
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        // --------------------------
        // Error scenario
        // --------------------------
        // By default NextAuth just gives `error: "CredentialsSignin"`,
        // but we can attempt to inspect the raw response (via `result.error`).
        try {
          const parsedError = JSON.parse(result.error);
          if (parsedError?.systemError) {
            // Backend explicitly told us it's a system-level issue
            showSystemErrorToast();
          } else {
            // Normal user-level login failure (invalid credentials, etc.)
            showRoleErrorToast("USER");
          }
        } catch {
          // If parsing fails → treat as user error
          showRoleErrorToast("USER");
        }
      } else {
        // --------------------------
        // Success scenario
        // --------------------------
        // Fetch session → contains user role
        const sessionRes = await fetch("/api/auth/session");
        if (!sessionRes.ok) {
          // Session fetch itself failed → system-level issue
          showSystemErrorToast();
          return;
        }

        const session = await sessionRes.json();

        // ✅ Role-aware success toast
        showRoleToast(session?.user?.role);

        // ✅ Smooth redirect (toast stays visible)
        setTimeout(() => {
          router.push("/dashboard");
        }, 500);
      }
    } catch (err) {
      console.error("❌ [LoginForm] Unexpected error:", err);
      // ✅ Network/server failure → system error
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
          Email
      ------------------------- */}
      <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
        Email
      </label>
      <input
        type="email"
        id="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
      />

      {/* -------------------------
          Password + toggle
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
          Submit
      ------------------------- */}
      <div className="text-center">
        <button
          type="submit"
          disabled={loading}
          className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-2xl shadow border-2 border-white"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>

      {/* -------------------------
          Footer
      ------------------------- */}
      <aside>
        <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
          <a href="/login" className="text-white hover:underline font-bold ml-1">
            Forgot your Password?
          </a>
        </p>
        <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
          Don’t have an account?
          <a href="/signup" className="text-white hover:underline font-bold ml-1">
            Join Now.
          </a>
        </p>
      </aside>
    </form>
  );
}









// 'use client';

// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";
// import { useRouter } from "next/navigation"; // ✅ smooth navigation
// import {
//   showRoleToast,
//   showRoleErrorToast,
//   showSystemErrorToast,
// } from "@/lib/toastMessages"; // ✅ success, error, and system error toasts

// export default function LoginForm() {
//   // ------------------------------
//   // State variables
//   // ------------------------------
//   const [showPassword, setShowPassword] = useState(false); // toggle password visibility
//   const [email, setEmail] = useState(""); // user email
//   const [password, setPassword] = useState(""); // user password
//   const [loading, setLoading] = useState(false); // button loading state

//   const router = useRouter(); // ✅ use Next.js router

//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // ------------------------------
//   // Handle login submission
//   // ------------------------------
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     try {
//       // ✅ Attempt login via NextAuth
//       const result = await signIn("credentials", {
//         redirect: false,
//         email,
//         password,
//       });

//       if (result?.error) {
//         // --------------------------
//         // When login fails (invalid credentials, etc.)
//         // --------------------------
//         // Here we can’t rely on backend's systemError flag (since NextAuth is handling it),
//         // so treat all failures as user-level errors.
//         showRoleErrorToast("USER");
//       } else {
//         // --------------------------
//         // Fetch session → contains user role
//         // --------------------------
//         const sessionRes = await fetch("/api/auth/session");
//         if (!sessionRes.ok) {
//           // If session endpoint itself failed → system-level issue
//           showSystemErrorToast();
//           return;
//         }

//         const session = await sessionRes.json();

//         // ✅ Role-aware success toast
//         showRoleToast(session?.user?.role);

//         // ✅ Smooth redirect (toast remains visible since no page reload)
//         setTimeout(() => {
//           router.push("/dashboard");
//         }, 500);
//       }
//     } catch (err) {
//       console.error("❌ [LoginForm] Unexpected error:", err);
//       // ✅ Explicit system-level error (network/server down)
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
//           Email input
//       ------------------------- */}
//       <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value)}
//         required
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
//       />

//       {/* -------------------------
//           Password input + toggle
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
//           Submit button
//       ------------------------- */}
//       <div className="text-center">
//         <button
//           type="submit"
//           disabled={loading}
//           className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-2xl shadow border-2 border-white"
//         >
//           {loading ? "Logging in..." : "Login"}
//         </button>
//       </div>

//       {/* -------------------------
//           Footer links
//       ------------------------- */}
//       <aside>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           <a href="/login" className="text-white hover:underline font-bold ml-1">
//             Forgot your Password?
//           </a>
//         </p>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           Don’t have an account?
//           <a href="/signup" className="text-white hover:underline font-bold ml-1">
//             Join Now.
//           </a>
//         </p>
//       </aside>
//     </form>
//   );
// }









// 'use client';

// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";
// import { useRouter } from "next/navigation"; // ✅ smooth navigation
// import {
//   showRoleToast,
//   showRoleErrorToast,
//   showSystemErrorToast,
// } from "@/lib/toastMessages"; // ✅ success, error, and system error toasts

// export default function LoginForm() {
//   // ------------------------------
//   // State variables
//   // ------------------------------
//   const [showPassword, setShowPassword] = useState(false); // toggle password visibility
//   const [email, setEmail] = useState(""); // user email
//   const [password, setPassword] = useState(""); // user password
//   const [loading, setLoading] = useState(false); // button loading state

//   const router = useRouter(); // ✅ use Next.js router

//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // ------------------------------
//   // Handle login submission
//   // ------------------------------
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     try {
//       // ✅ Attempt login via NextAuth
//       const result = await signIn("credentials", {
//         redirect: false,
//         email,
//         password,
//       });

//       if (result?.error) {
//         // Known login failure → role-aware error toast
//         showRoleErrorToast("USER");
//       } else {
//         // ✅ Fetch session to determine role
//         const sessionRes = await fetch("/api/auth/session");
//         if (!sessionRes.ok) throw new Error("Failed to fetch session");
//         const session = await sessionRes.json();

//         // ✅ Role-aware success toast
//         showRoleToast(session?.user?.role);

//         // ✅ Smooth redirect (toast remains visible)
//         setTimeout(() => {
//           router.push("/dashboard");
//         }, 500);
//       }
//     } catch (err) {
//       console.error("❌ [LoginForm] Unexpected error:", err);
//       // System-level error (e.g., server down, fetch failed)
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
//           Email input
//       ------------------------- */}
//       <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value)}
//         required
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
//       />

//       {/* -------------------------
//           Password input + toggle
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
//           Submit button
//       ------------------------- */}
//       <div className="text-center">
//         <button
//           type="submit"
//           disabled={loading}
//           className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-2xl shadow border-2 border-white"
//         >
//           {loading ? "Logging in..." : "Login"}
//         </button>
//       </div>

//       {/* -------------------------
//           Footer links
//       ------------------------- */}
//       <aside>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           <a href="/login" className="text-white hover:underline font-bold ml-1">
//             Forgot your Password?
//           </a>
//         </p>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           Don’t have an account?
//           <a href="/signup" className="text-white hover:underline font-bold ml-1">
//             Join Now.
//           </a>
//         </p>
//       </aside>
//     </form>
//   );
// }









// 'use client';

// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";
// import { useRouter } from "next/navigation"; // ✅ use router for smooth navigation
// import { showRoleToast, showRoleErrorToast } from "@/lib/toastMessages"; // ✅ success + error toast helpers

// export default function LoginForm() {
//   // ------------------------------
//   // State variables
//   // ------------------------------
//   const [showPassword, setShowPassword] = useState(false); // toggle password visibility
//   const [email, setEmail] = useState(""); // store user email
//   const [password, setPassword] = useState(""); // store user password
//   const [loading, setLoading] = useState(false); // button loading state

//   const router = useRouter(); // ✅ Next.js router for navigation

//   // Toggle password visibility
//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // ------------------------------
//   // Handle login submission
//   // ------------------------------
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     // ✅ Attempt NextAuth sign-in (no redirect yet)
//     const result = await signIn("credentials", {
//       redirect: false, // disable auto redirect
//       email,
//       password,
//     });

//     if (result?.error) {
//       // ------------------------
//       // Role-aware error toast
//       // ------------------------
//       // We don’t know role if login failed → fallback to "USER"
//       showRoleErrorToast("USER");
//     } else {
//       // ✅ Fetch session so we know the logged-in user's role
//       const sessionRes = await fetch("/api/auth/session");
//       const session = await sessionRes.json();

//       // ------------------------
//       // Role-aware success toast
//       // ------------------------
//       showRoleToast(session?.user?.role);

//       // ✅ Smooth redirect (toast stays visible because router.push doesn’t reload the page)
//       setTimeout(() => {
//         router.push("/dashboard");
//       }, 500); // slight delay so toast displays before redirect
//     }

//     setLoading(false);
//   };

//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
//       {/* -------------------------
//           Email input
//       ------------------------- */}
//       <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value)}
//         required
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
//       />

//       {/* -------------------------
//           Password input + toggle
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
//           className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white"
//         />
//         {/* Toggle button for password visibility */}
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
//           Submit button
//       ------------------------- */}
//       <div className="text-center">
//         <button
//           type="submit"
//           disabled={loading}
//           className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-2xl shadow border-2 border-white"
//         >
//           {loading ? "Logging in..." : "Login"}
//         </button>
//       </div>

//       {/* -------------------------
//           Footer links
//       ------------------------- */}
//       <aside>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           <a href="/login" className="text-white hover:underline font-bold ml-1">
//             Forgot your Password?
//           </a>
//         </p>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           Don’t have an account?
//           <a href="/signup" className="text-white hover:underline font-bold ml-1">
//             Join Now.
//           </a>
//         </p>
//       </aside>
//     </form>
//   );
// }










// 'use client';

// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";
// import { useRouter } from "next/navigation"; // ✅ use router for navigation
// import toast from "react-hot-toast";
// import { showRoleToast } from "@/lib/toastMessages"; // ✅ role-aware toast helper

// export default function LoginForm() {
//   // ------------------------------
//   // State variables
//   // ------------------------------
//   const [showPassword, setShowPassword] = useState(false); // toggle password visibility
//   const [email, setEmail] = useState(""); // store user email
//   const [password, setPassword] = useState(""); // store user password
//   const [loading, setLoading] = useState(false); // button loading state

//   const router = useRouter(); // ✅ Next.js router for smooth navigation

//   // Toggle password visibility
//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // ------------------------------
//   // Handle login submission
//   // ------------------------------
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     // ✅ Attempt NextAuth sign-in (no redirect yet)
//     const result = await signIn("credentials", {
//       redirect: false, // disable auto-redirect
//       email,
//       password,
//     });

//     if (result?.error) {
//       // Show error toast if login fails
//       toast.error("Invalid email or password", { duration: 6000 });
//     } else {
//       // ✅ Fetch session so we know the logged-in user's role
//       const sessionRes = await fetch("/api/auth/session");
//       const session = await sessionRes.json();

//       // ✅ Show personalized toast based on role
//       showRoleToast(session?.user?.role);

//       // ✅ Smooth redirect (toast stays visible because router.push doesn't reload the page)
//       setTimeout(() => {
//         router.push("/dashboard");
//       }, 500); // small delay ensures toast is rendered first
//     }

//     setLoading(false);
//   };

//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
//       {/* -------------------------
//           Email input
//       ------------------------- */}
//       <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value)}
//         required
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
//       />

//       {/* -------------------------
//           Password input + toggle
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
//           className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white"
//         />
//         {/* Toggle button for password visibility */}
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
//           Submit button
//       ------------------------- */}
//       <div className="text-center">
//         <button
//           type="submit"
//           disabled={loading}
//           className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-2xl shadow border-2 border-white"
//         >
//           {loading ? "Logging in..." : "Login"}
//         </button>
//       </div>

//       {/* -------------------------
//           Footer links
//       ------------------------- */}
//       <aside>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           <a href="/login" className="text-white hover:underline font-bold ml-1">
//             Forgot your Password?
//           </a>
//         </p>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           Don’t have an account?
//           <a href="/signup" className="text-white hover:underline font-bold ml-1">
//             Join Now.
//           </a>
//         </p>
//       </aside>
//     </form>
//   );
// }









// 'use client';

// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";
// import toast from "react-hot-toast";
// import { showRoleToast } from "@/lib/toastMessages"; // ✅ role-aware toast helper

// export default function LoginForm() {
//   // ------------------------------
//   // State variables
//   // ------------------------------
//   const [showPassword, setShowPassword] = useState(false);
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [loading, setLoading] = useState(false);

//   // Toggle password visibility
//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // ------------------------------
//   // Handle login submission
//   // ------------------------------
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     // ✅ NextAuth login (no redirect yet)
//     const result = await signIn("credentials", {
//       redirect: false,
//       email,
//       password,
//     });

//     if (result?.error) {
//       toast.error("Invalid email or password");
//     } else {
//       // ✅ Fetch session to know user role
//       const sessionRes = await fetch("/api/auth/session");
//       const session = await sessionRes.json();

//       // ✅ Show personalized toast by role
//       showRoleToast(session?.user?.role);

//       // ✅ Redirect manually to dashboard
//       window.location.href = "/dashboard";
//     }

//     setLoading(false);
//   };

//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
//       {/* -------------------------
//           Email input
//       ------------------------- */}
//       <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value)}
//         required
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
//       />

//       {/* -------------------------
//           Password input + toggle
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
//           Submit button
//       ------------------------- */}
//       <div className="text-center">
//         <button
//           type="submit"
//           disabled={loading}
//           className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-2xl shadow border-2 border-white"
//         >
//           {loading ? "Logging in..." : "Login"}
//         </button>
//       </div>

//       {/* -------------------------
//           Footer links
//       ------------------------- */}
//       <aside>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           <a href="/login" className="text-white hover:underline font-bold ml-1">
//             Forgot your Password?
//           </a>
//         </p>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           Don’t have an account?
//           <a href="/signup" className="text-white hover:underline font-bold ml-1">
//             Join Now.
//           </a>
//         </p>
//       </aside>
//     </form>
//   );
// }










// 'use client';

// import { useState, FormEvent } from "react";
// import { signIn } from "next-auth/react";
// import toast from "react-hot-toast";

// export default function LoginForm() {
//   const [showPassword, setShowPassword] = useState(false);
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState(""); // ✅ Plaintext password (only used here, hashed on backend)
//   const [loading, setLoading] = useState(false);

//   // Toggle password visibility
//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // Handle form submit → NextAuth signIn
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     // ✅ Send email + plaintext password to NextAuth
//     // NextAuth will compare this against the hashedPassword in DB
//     const result = await signIn("credentials", {
//       redirect: true,
//       email,
//       password,
//       callbackUrl: "/dashboard",
//     });

//     if (result?.error) {
//       toast.error("Invalid email or password");
//     }

//     setLoading(false);
//   };

//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
//       {/* Email input */}
//       <label htmlFor="email" className="text-left text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value)}
//         required
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
//       />

//       {/* Password input */}
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

//       {/* Submit button */}
//       <div className="text-center">
//         <button
//           type="submit"
//           disabled={loading}
//           className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-2xl shadow border-2 border-white"
//         >
//           {loading ? "Logging in..." : "Login"}
//         </button>
//       </div>

//       {/* Links */}
//       <aside>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           <a href="/login" className="text-white hover:underline font-bold ml-1">
//             Forgot your Password?
//           </a>
//         </p>
//         <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
//           Dont have n account?
//           <a href="/signup" className="text-white hover:underline font-bold ml-1">
//             Join Now.
//           </a>
//         </p>
//       </aside>
//     </form>
//   );
// }

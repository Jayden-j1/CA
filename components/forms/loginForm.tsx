'use client';

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  showRoleToast,
  showRoleErrorToast,
  showSystemErrorToast,
} from "@/lib/toastMessages";

export default function LoginForm() {
  // ------------------------------
  // State
  // ------------------------------
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  // ------------------------------
  // Handle login
  // ------------------------------
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      // ✅ Attempt login with NextAuth
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        // ------------------------------
        // Parse error
        // ------------------------------
        try {
          const parsedError = JSON.parse(result.error);
          if (parsedError?.systemError) {
            showSystemErrorToast();
          } else {
            showRoleErrorToast("USER");
          }
        } catch {
          if (result.error === "Invalid credentials") {
            showRoleErrorToast("USER");
          } else {
            showSystemErrorToast();
          }
        }
      } else {
        // ------------------------------
        // Success
        // ------------------------------
        const sessionRes = await fetch("/api/auth/session");
        if (!sessionRes.ok) {
          showSystemErrorToast();
          return;
        }

        const session = await sessionRes.json();

        showRoleToast(session?.user?.role);

        // Smooth redirect
        setTimeout(() => {
          router.push("/dashboard");
        }, 500);
      }
    } catch (err) {
      console.error("❌ [LoginForm] Unexpected error:", err);
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
          className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white"
        />
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none cursor-pointer"
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
          className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-2xl shadow border-2 border-white cursor-pointer"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>

      {/* -------------------------
          Footer
      ------------------------- */}
      <aside>
        {/* ✅ Fixed: link to /forgot-password */}
        <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
          <a href="/forgot-password" className="text-white hover:underline font-bold ml-1">
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

'use client';

import ButtonWithSpinner from "../ui/buttonWithSpinner"; 
import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import { emailRegex, suggestDomain } from "@/utils/emailValidation";

// --- Email validation helpers ---
const commonDomains = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "protonmail.com",
  "aol.com",
  "live.com"
];

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
        onChange={(e) => setEmail(e.target.value.trim())}
        required
        placeholder="you@example.com"
        className={`block w-full border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white
          ${emailRegex.test(email) ? 'border-green-500' : 'border-red-500'}`}
        autoComplete="email"
        inputMode="email"
      />
      {!emailRegex.test(email) && suggestDomain(email) && (
        <div className="flex items-center space-x-2 mt-1 text-yellow-400 text-sm">
          <span>Did you mean <strong>{suggestDomain(email)}</strong>?</span>
          <button
            type="button"
            onClick={() => setEmail(suggestDomain(email)!)}
            className="ml-2 px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
          >
            ✅ Use this
          </button>
        </div>
      )}

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
      {/* ... unchanged ... */}

      {/* Business Name (only if Business is selected) */}
      {/* ... unchanged ... */}

      {/* Submit Button */}
      <div className="text-center">
        <ButtonWithSpinner type="submit" loading={loading}>
          {loading ? "Signing Up..." : "Sign Up"}
        </ButtonWithSpinner>
      </div>

      {/* Links */}
      {/* ... unchanged ... */}
    </form>
  );
}

'use client';

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";

interface SignupFormProps {
  redirectTo?: string; // optional redirect after signup
}

export default function SignupForm({ redirectTo }: SignupFormProps) {
  // Form state
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [userType, setUserType] = useState<"individual" | "business">("individual");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");

  // Toggle password visibility
  const togglePasswordVisibility = () => setShowPassword(prev => !prev);

  // Handle form submission
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // 1️⃣ Create user in database via API route
    // (you will implement /api/auth/signup)
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

    if (!response.ok) {
      alert("Signup failed. Please check your info and try again.");
      return;
    }

    // 2️⃣ Automatically sign in the user after signup
    await signIn("credentials", {
      email,
      password,
      callbackUrl: redirectTo || "/dashboard",
    });
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
        className="block w-full border-white border-2 rounded-2xl px-4 py-3
          focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
          bg-transparent text-white placeholder-white"
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
        className="block w-full border-white border-2 rounded-2xl px-4 py-3
          focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
          bg-transparent text-white placeholder-white"
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
          className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20
            focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
            bg-transparent text-white placeholder-white"
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
      <fieldset className="mt-4 border-t border-white pt-4">
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

      {/* Business Name (shown only if Business is selected) */}
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
            className="block w-full border-white border-2 rounded-2xl px-4 py-3
              focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
              bg-transparent text-white placeholder-white"
          />
        </>
      )}

      {/* Signup Button */}
      <div className="text-center">
        <button
          type="submit"
          className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-4xl shadow-2xl
            border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer"
        >
          Sign Up
        </button>
      </div>

      {/* Links */}
      <aside>
        <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
          Already have an account?
          <a href="/login" className="text-white hover:underline font-bold ml-1">Log in</a>.
        </p>
      </aside>
    </form>
  );
}

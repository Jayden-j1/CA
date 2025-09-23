'use client';

import { useState } from "react";

export default function Login() {
  // State to toggle password visibility
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Toggle function
  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  return (
    <>
      {/* Form */}
      <form
        action="#"
        method="post"
        className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
      >
        {/* Email Label and Input */}
        <label
          htmlFor="email"
          className="text-left text-white font-bold text-sm tracking-wide md:text-base"
        >
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          autoFocus
          className="block w-full border-white border-2 rounded-2xl px-4 py-3
            focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
            bg-transparent text-white placeholder-white"
        />

        {/* Password Label and Input */}
        <label
          htmlFor="password"
          className="text-left text-white font-bold text-sm tracking-wide md:text-base"
        >
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            name="password"
            required
            className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20
              focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
              bg-transparent text-white placeholder-white"
          />

          {/* Show and hide password button */}
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none"
            tabIndex={-1}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        {/* Login Button */}
        <div className="text-center">
          <button
            id="loginBtn"
            type="submit"
            className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-4xl shadow-2xl
              border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer"
          >
            Login
          </button>
        </div>

        {/* Forgot Password and Join now links */}
        <aside>
          <p className="text-white text-xs sm:text-sm md:text-base mt-2 text-center sm:text-left leading-relaxed">
            <a href="#" className="text-white hover:underline">
              Forgot your password?
            </a>
            <br />
            Don't have an account?
            <a href="/signup" className="text-white hover:underline font-bold ml-1">Join now</a>.
          </p>
        </aside>
      </form>
    </>
  );
}

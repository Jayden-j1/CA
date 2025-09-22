// components/ui/ButtonWithSpinner.tsx
//
// Purpose:
// - A reusable button component with a built-in loading spinner.
// - Prevents button resizing by showing spinner + text inline.
// - Keeps consistent styling across Signup, AddStaff, and other forms.
//
// Props:
// - loading (boolean): whether to show the spinner.
// - children (ReactNode): the button text/label (e.g., "Sign Up").
// - disabled (boolean): disables the button when true.
// - className (string): allows extra Tailwind classes for customization.
// - type (string): usually "submit" or "button".
// - onClick (function): optional click handler for non-form buttons.
//
// Usage example:
// <ButtonWithSpinner loading={loading} type="submit">
//   Sign Up
// </ButtonWithSpinner>

import React from "react";

// ✅ Spinner inside button (no need for separate Spinner.tsx anymore)
function InlineSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      ></path>
    </svg>
  );
}

interface ButtonWithSpinnerProps {
  loading?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
}

export default function ButtonWithSpinner({
  loading = false,
  children,
  disabled,
  className = "",
  type = "button",
  onClick,
}: ButtonWithSpinnerProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className={`px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-4xl shadow-2xl border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 ${className}`}
    >
      {loading && <InlineSpinner />} {/* spinner only when loading */}
      <span>{children}</span> {/* always keep label visible */}
    </button>
  );
}

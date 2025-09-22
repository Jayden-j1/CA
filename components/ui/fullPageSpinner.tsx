// components/ui/FullPageSpinner.tsx
//
// Purpose:
// - Reusable full-page spinner with optional message.
// - Centers spinner + text vertically and horizontally.
//
// Props:
// - message (string): optional text under/next to spinner.
// - color (string): spinner color (default: green).

interface FullPageSpinnerProps {
  message?: string;
  color?: string;
}

export default function FullPageSpinner({
  message = "Loading...",
  color = "text-green-500",
}: FullPageSpinnerProps) {
  return (
    <section className="w-full min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-700 to-blue-300">
      <div className="flex items-center gap-3 text-white text-xl">
        <svg
          className={`animate-spin h-8 w-8 ${color}`}
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
        <span>{message}</span>
      </div>
    </section>
  );
}

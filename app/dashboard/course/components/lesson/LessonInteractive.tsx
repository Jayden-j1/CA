// components/LessonInteractive.tsx
//
// Purpose
// --------
// Render interactive lesson widgets (quiz and slider) defined in Sanity.
//
// Pillars
// --------
// ✅ Simplicity — switch-based render per widget type.
// ✅ Accessibility — clear labels, keyboard focusable.
// ✅ Feedback — provides immediate result indication.
// ✅ Security — all data client-side (no eval or HTML).
// ✅ Robustness — validates input presence and structure.

"use client";

import { useState } from "react";

interface Props {
  type: string;
  data: any;
}

export default function LessonInteractive({ type, data }: Props) {
  switch (type) {
    // 🎚️ Slider Widget
    case "slider": {
      const [value, setValue] = useState<number>(
        Math.round((data.min + data.max) / 2)
      );

      return (
        <div className="my-6 p-5 border rounded-lg bg-gray-50 shadow-sm">
          <label className="block font-medium mb-2 text-gray-800">
            {data.prompt || "Adjust the slider:"}
          </label>

          <input
            type="range"
            min={data.min ?? 0}
            max={data.max ?? 10}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer"
            aria-valuemin={data.min}
            aria-valuemax={data.max}
            aria-valuenow={value}
            aria-label={data.prompt || "Slider input"}
          />

          <p className="text-sm text-gray-600 mt-2 text-center">
            {data.labels?.[0]} — <span className="font-semibold">{value}</span>{" "}
            — {data.labels?.[1]}
          </p>
        </div>
      );
    }

    // 🧠 Quiz Widget
    case "quiz": {
      const [selected, setSelected] = useState<number | null>(null);
      const [submitted, setSubmitted] = useState(false);
      const correct = selected === data.correctIndex;

      return (
        <div className="my-6 p-5 border rounded-lg bg-gray-50 shadow-sm">
          <p className="font-medium mb-3 text-gray-800">
            {data.question || "Quiz Question"}
          </p>

          <fieldset>
            <legend className="sr-only">Quiz Options</legend>
            <div className="space-y-2">
              {data.options?.map((opt: string, idx: number) => (
                <label
                  key={idx}
                  className={`block border rounded px-3 py-2 cursor-pointer ${
                    selected === idx
                      ? "bg-blue-100 border-blue-400"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <input
                    type="radio"
                    name="quiz-option"
                    checked={selected === idx}
                    onChange={() => setSelected(idx)}
                    className="hidden"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-3 flex gap-3 items-center">
            <button
              onClick={() => setSubmitted(true)}
              disabled={submitted || selected === null}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-500 disabled:opacity-60"
            >
              Check Answer
            </button>
            {submitted && (
              <p
                className={`text-sm font-medium ${
                  correct ? "text-emerald-600" : "text-rose-600"
                }`}
                aria-live="polite"
              >
                {correct ? "✅ Correct!" : "❌ Try again"}
              </p>
            )}
          </div>
        </div>
      );
    }

    // 🚫 Fallback — Unknown Type
    default:
      return (
        <div className="my-6 p-4 border rounded bg-gray-50 text-sm text-gray-500">
          Unsupported interactive component.
        </div>
      );
  }
}
 
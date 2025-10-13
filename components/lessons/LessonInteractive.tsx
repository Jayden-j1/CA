"use client";
import { useState } from "react";

export default function LessonInteractive({
  type,
  data,
}: {
  type: string;
  data: any;
}) {
  switch (type) {
    case "slider": {
      const [val, setVal] = useState((data.min + data.max) / 2);
      return (
        <div className="my-6 p-4 border rounded-lg bg-gray-50">
          <p className="font-medium mb-2">{data.prompt}</p>
          <input
            type="range"
            min={data.min}
            max={data.max}
            value={val}
            onChange={(e) => setVal(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <p className="text-sm text-gray-600 mt-1">
            {data.labels?.[0]} — {val} — {data.labels?.[1]}
          </p>
        </div>
      );
    }
    case "quiz": {
      const [selected, setSelected] = useState<number | null>(null);
      const [submitted, setSubmitted] = useState(false);
      const correct = selected === data.correctIndex;
      return (
        <div className="my-6 p-5 border rounded-lg bg-gray-50">
          <p className="font-medium mb-3">{data.question}</p>
          <div className="space-y-2">
            {data.options.map((opt: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setSelected(idx)}
                className={`w-full text-left px-3 py-2 border rounded ${
                  selected === idx
                    ? "bg-blue-100 border-blue-400"
                    : "hover:bg-gray-100"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setSubmitted(true)}
              disabled={submitted}
              className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-60"
            >
              Check
            </button>
            {submitted && (
              <p className="text-sm font-medium">
                {correct ? "✅ Correct!" : "❌ Try again"}
              </p>
            )}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

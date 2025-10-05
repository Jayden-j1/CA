// components/course/QuizCard.tsx
//
// Purpose:
// - Render a multiple-question quiz with radio inputs.
// - Stateless; all answers provided via props.
//
// Accessibility:
// - Fieldset/legend + labeled controls for screen readers.

"use client";

import React from "react";
import type { CourseQuiz } from "@/types/course";

interface QuizCardProps {
  quiz: CourseQuiz;
  answers: Record<string, number | null>; // questionId -> selected option index
  onChange: (questionId: string, optionIndex: number) => void;
  onSubmit: () => void;
}

const QuizCard: React.FC<QuizCardProps> = ({
  quiz,
  answers,
  onChange,
  onSubmit,
}) => {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Quiz: Test your knowledge</h3>

      <div className="space-y-5">
        {quiz.questions.map((q) => (
          <fieldset key={q.id} className="space-y-2">
            <legend className="font-medium">{q.question}</legend>

            <div className="flex flex-wrap gap-3">
              {q.options.map((opt, i) => {
                const inputId = `${q.id}-${i}`;
                const checked = answers[q.id] === i;
                return (
                  <label
                    key={i}
                    htmlFor={inputId}
                    className={`
                      inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer
                      ${checked ? "border-blue-600 bg-blue-50 text-blue-900" : "border-gray-300 hover:bg-gray-100"}
                    `}
                  >
                    <input
                      id={inputId}
                      type="radio"
                      name={q.id}
                      value={i}
                      className="accent-blue-600"
                      checked={checked}
                      onChange={() => onChange(q.id, i)}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <button
        onClick={onSubmit}
        className="mt-5 inline-flex items-center justify-center px-5 py-2 rounded-lg font-semibold
                   bg-blue-600 hover:bg-blue-500 text-white shadow transition-transform hover:scale-[1.02]"
      >
        Submit & Continue
      </button>
    </div>
  );
};

export default QuizCard;

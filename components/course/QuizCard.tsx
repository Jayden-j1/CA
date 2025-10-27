// components/course/QuizCard.tsx
//
// Purpose:
// - Render a multiple-question quiz with radio inputs.
// - Stateless regarding correctness logic; parent passes in:
//     • answers: Record<questionId, selectedIndex|null>
//     • revealed: boolean (once true, show red/green feedback)
//     • onChange(questionId, optionIndex)
//     • onSubmit()  → parent will set revealed=true and handle auto-advance
//
// UX spec (per product request):
// - No score or pass/fail message.
// - After Submit, highlight options:
//     • Correct option = green
//     • Selected wrong option = red
//     • Others stay neutral
// - Inputs are disabled once revealed (to avoid changing answers during the
//   short auto-advance window).
//
// Security/robustness:
// - No business logic here (no role/payments).
// - Pure presentational component with tiny behavior.
// - Defensive guards for unexpected shapes.
//
// Pillars:
// - Simplicity: minimal props, no local correctness state.
// - Robustness: safe checks around indices.
// - Accessibility: fieldset/legend, labeled radios.

"use client";

import React from "react";
import type { CourseQuiz } from "@/types/course";

interface QuizCardProps {
  quiz: CourseQuiz;
  answers: Record<string, number | null>; // questionId -> selected option index
  revealed: boolean;                       // when true, show red/green feedback and disable inputs
  onChange: (questionId: string, optionIndex: number) => void;
  onSubmit: () => void;
}

const QuizCard: React.FC<QuizCardProps> = ({
  quiz,
  answers,
  revealed,
  onChange,
  onSubmit,
}) => {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Quiz: Test your knowledge</h3>

      <div className="space-y-5">
        {quiz.questions.map((q) => {
          const selected = answers[q.id];
          const correctIndex =
            typeof q.correctIndex === "number" && Number.isFinite(q.correctIndex)
              ? q.correctIndex
              : -1;

          return (
            <fieldset key={q.id} className="space-y-2">
              <legend className="font-medium">{q.question}</legend>

              <div className="flex flex-wrap gap-3">
                {q.options.map((opt, i) => {
                  const inputId = `${q.id}-${i}`;
                  const isSelected = selected === i;

                  // Styling rules:
                  // - Before reveal → standard selection styling.
                  // - After reveal:
                  //   • Correct option: green (regardless of selection)
                  //   • Selected wrong option: red
                  //   • Others: neutral
                  let labelClass =
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors";

                  if (!revealed) {
                    labelClass += isSelected
                      ? " border-blue-600 bg-blue-50 text-blue-900"
                      : " border-gray-300 hover:bg-gray-100";
                  } else {
                    const isCorrect = i === correctIndex;
                    if (isCorrect) {
                      labelClass += " border-green-600 bg-green-50 text-green-900";
                    } else if (isSelected && !isCorrect) {
                      labelClass += " border-red-600 bg-red-50 text-red-900";
                    } else {
                      labelClass += " border-gray-300 bg-white text-gray-700";
                    }
                  }

                  return (
                    <label key={i} htmlFor={inputId} className={labelClass}>
                      <input
                        id={inputId}
                        type="radio"
                        name={q.id}
                        value={i}
                        className="accent-blue-600"
                        checked={isSelected || false}
                        onChange={() => onChange(q.id, i)}
                        disabled={revealed} // prevent edits after reveal
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      <button
        onClick={onSubmit}
        disabled={revealed} // prevent double-submit while auto-advance is pending
        className="mt-5 inline-flex items-center justify-center px-5 py-2 rounded-lg font-semibold
                   bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white shadow transition-transform hover:scale-[1.02]"
      >
        {revealed ? "Submitting…" : "Submit"}
      </button>
    </div>
  );
};

export default QuizCard;











// // components/course/QuizCard.tsx
// //
// // Purpose:
// // - Render a multiple-question quiz with radio inputs.
// // - Stateless; all answers provided via props.
// //
// // Accessibility:
// // - Fieldset/legend + labeled controls for screen readers.

// "use client";

// import React from "react";
// import type { CourseQuiz } from "@/types/course";

// interface QuizCardProps {
//   quiz: CourseQuiz;
//   answers: Record<string, number | null>; // questionId -> selected option index
//   onChange: (questionId: string, optionIndex: number) => void;
//   onSubmit: () => void;
// }

// const QuizCard: React.FC<QuizCardProps> = ({
//   quiz,
//   answers,
//   onChange,
//   onSubmit,
// }) => {
//   return (
//     <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
//       <h3 className="text-lg font-semibold mb-4">Quiz: Test your knowledge</h3>

//       <div className="space-y-5">
//         {quiz.questions.map((q) => (
//           <fieldset key={q.id} className="space-y-2">
//             <legend className="font-medium">{q.question}</legend>

//             <div className="flex flex-wrap gap-3">
//               {q.options.map((opt, i) => {
//                 const inputId = `${q.id}-${i}`;
//                 const checked = answers[q.id] === i;
//                 return (
//                   <label
//                     key={i}
//                     htmlFor={inputId}
//                     className={`
//                       inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer
//                       ${checked ? "border-blue-600 bg-blue-50 text-blue-900" : "border-gray-300 hover:bg-gray-100"}
//                     `}
//                   >
//                     <input
//                       id={inputId}
//                       type="radio"
//                       name={q.id}
//                       value={i}
//                       className="accent-blue-600"
//                       checked={checked}
//                       onChange={() => onChange(q.id, i)}
//                     />
//                     <span>{opt}</span>
//                   </label>
//                 );
//               })}
//             </div>
//           </fieldset>
//         ))}
//       </div>

//       <button
//         onClick={onSubmit}
//         className="mt-5 inline-flex items-center justify-center px-5 py-2 rounded-lg font-semibold
//                    bg-blue-600 hover:bg-blue-500 text-white shadow transition-transform hover:scale-[1.02]"
//       >
//         Submit & Continue
//       </button>
//     </div>
//   );
// };

// export default QuizCard;

'use client';

/**
 * ContactFormComponent
 * --------------------
 * Purpose:
 * - Collect basic contact details + a message from the user.
 * - Let the user choose their preferred contact method via radio buttons.
 *
 * Important notes:
 * - This is a purely FRONT-END form right now:
 *   • action="#" and method="post" → no real backend wiring yet.
 *   • No data is sent to an API or email service in this file.
 * - Validation here is *only* client-side convenience:
 *   • Mobile is restricted to numeric-only and 10 digits.
 *   • Email is checked against emailRegex and shows a "Did you mean...?" hint.
 * - When you later connect this to a real API:
 *   • ALWAYS repeat validation on the server.
 *   • NEVER trust these client-side checks as security controls.
 *
 * What changed earlier (and remains now):
 * - Radio buttons are native <input type="radio" /> styled similarly to Signup.
 * - State management for radios, mobile, and email is unchanged.
 *
 * Pillars covered:
 * - Simplicity: minimal state, clear handlers.
 * - Robustness: basic front-end validation + clear visual feedback.
 * - Ease of management: field names/ids are consistent and obvious.
 * - Security: comments explicitly remind future-you to re-validate on the server.
 */

import { useState } from 'react';
import { emailRegex, suggestDomain } from "@/utils/emailValidation";

export default function ContactFormComponent() {
  /**
   * selected
   * --------
   * Tracks which "Preferred contact method" radio is selected.
   * Allowed values:
   * - "email"
   * - "mobile"
   * - "textMessage"
   * - "" (nothing selected yet)
   *
   * This is purely UI state. It does NOT send anything by itself; the value
   * is submitted via the normal HTML form POST if you wire up a backend later.
   */
  const [selected, setSelected] = useState<'email' | 'mobile' | 'textMessage' | ''>('');

  /**
   * mobileNumber
   * ------------
   * Stores the user's mobile number as a string.
   * - We restrict it to numbers only.
   * - We cap the length to 10 digits.
   * Visual feedback:
   * - When length === 10 → border turns green.
   * - Otherwise          → border turns red.
   *
   * NOTE: This is UX only, not security. The backend must still sanitise/validate.
   */
  const [mobileNumber, setMobileNumber] = useState('');

  /**
   * email
   * -----
   * Stores the user's email input.
   * - We use emailRegex to visually mark valid vs invalid.
   * - suggestDomain(email) is used to offer a "Did you mean...?" helper if there
   *   is a likely typo (e.g. gmall.com → gmail.com).
   *
   * Again, this is for user experience. The server must re-check the email string.
   */
  const [email, setEmail] = useState('');

  /**
   * handleRadioChange
   * -----------------
   * Simple helper to set which contact method the user prefers.
   * This keeps the JSX for the radios tiny and readable.
   */
  const handleRadioChange = (value: 'email' | 'mobile' | 'textMessage') => {
    setSelected(value);
  };

  return (
    /**
     * Form wrapper
     * ------------
     * - action="#": placeholder, does not submit to a real endpoint yet.
     * - method="post": standard HTML POST if/when wired to a backend route.
     *
     * Design:
     * - White card, rounded corners, shadow, padding.
     * - Matches the visual shell of your Signup-style forms.
     *
     * Security reminder:
     * - This component does NOT enforce security by itself.
     * - Treat it as a UX layer. Server-side code must validate and rate-limit.
     */
    <form
      action="#"
      method="post"
      className="w-full max-w-xl bg-white rounded-xl shadow p-6 space-y-4 my-5"
    >
      {/* Name Input (basic required text field) */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Name
        </label>
        <input
          type="text"
          name="name"
          id="name"
          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
          required
          autoFocus
        />
      </div>

      {/* Mobile Input
          - Restricted to digits only via onChange.
          - Capped at 10 digits.
          - Visual border color reflects whether it's exactly 10 digits. */}
      <div>
        <label htmlFor="mobileNumber" className="block text-sm font-medium mb-1">
          Mobile
        </label>
        <input
          type="tel"
          name="mobileNumber"
          id="mobileNumber"
          value={mobileNumber}
          onChange={(e) => {
            // Strip non-digits and keep only the first 10 characters.
            // This keeps the state "clean" and predictable.
            const value = e.target.value.replace(/\D/g, '').slice(0, 10);
            setMobileNumber(value);
          }}
          className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring text-gray-900
            ${mobileNumber.length === 10
              ? 'border-green-500 focus:ring-green-200'
              : 'border-red-500 focus:ring-red-200'}`}
          required
          placeholder="04XX XXX XXX"
          maxLength={10}
        />
      </div>

      {/* Phone Input
          - Optional second phone field.
          - Currently marked as required in HTML, but placeholder suggests it's optional.
          - This is UX configuration; no security impact.
          - When wiring up to a backend, you can decide whether to keep it required or not. */}
      <div>
        <label htmlFor="phoneNumber" className="block text-sm font-medium mb-1">
          Phone
        </label>
        <input
          type="tel"
          name="phoneNumber"
          id="phoneNumber"
          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
          required
          placeholder="Optional"
        />
      </div>

      {/* Email Input
          - Uses emailRegex for basic validation.
          - Uses suggestDomain(email) to hint at likely domain typos.
          - Border color indicates whether the emailRegex passes. */}
      <div>
        <label htmlFor="contactEmail" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          type="email"
          name="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
          className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring text-gray-900
            ${emailRegex.test(email)
              ? 'border-green-500 focus:ring-green-200'
              : 'border-red-500 focus:ring-red-200'}`}
          required
          placeholder="you@example.com"
          autoComplete="email"
          inputMode="email"
        />

        {/* Suggestion banner
            - Only shows when:
              • current email does NOT pass emailRegex, AND
              • suggestDomain(email) returns a suggestion.
            - The button lets the user accept the suggested complete email. */}
        {!emailRegex.test(email) && suggestDomain(email) && (
          <div className="flex items-center space-x-2 mt-1 text-yellow-700 text-sm">
            <span>
              Did you mean <strong>{suggestDomain(email)}</strong>?
            </span>
            <button
              type="button"
              onClick={() => setEmail(suggestDomain(email)!)}
              className="ml-2 px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
            >
              ✅ Use this
            </button>
          </div>
        )}
      </div>

      {/* Message Textarea
          - Free-form text for the user's message.
          - Not required by HTML, but most people will type here.
          - "resize-y" lets the user extend vertically if needed. */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium mb-1">
          Your Message
        </label>
        <textarea
          name="message"
          id="message"
          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200 resize-y min-h-[120px] text-gray-900"
          placeholder="Write your message here..."
        />
      </div>

      {/* Preferred contact method (radio buttons)
          - Uses native radios for better accessibility & keyboard support.
          - UI matches the look-and-feel of the Signup radios. */}
      <fieldset className="my-2 border-0 p-0 m-0">
        {/* Legend describes the group of radios for screen readers. */}
        <legend className="block text-sm font-medium mb-2">Preferred contact method</legend>

        <div className="flex items-center gap-6">
          {/* Email option */}
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="preferredContact"
              value="email"
              checked={selected === 'email'}
              onChange={() => handleRadioChange('email')}
            />
            <span className="text-sm text-gray-700">Email</span>
          </label>

          {/* Mobile option */}
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="preferredContact"
              value="mobile"
              checked={selected === 'mobile'}
              onChange={() => handleRadioChange('mobile')}
            />
            <span className="text-sm text-gray-700">Mobile</span>
          </label>

          {/* Text Message option */}
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="preferredContact"
              value="textMessage"
              checked={selected === 'textMessage'}
              onChange={() => handleRadioChange('textMessage')}
            />
            <span className="text-sm text-gray-700">Text Message</span>
          </label>
        </div>
      </fieldset>

      {/* Submit button
          - Currently just submits the HTML form to "#".
          - When wiring up to an API route or external service, you can:
            • Use onSubmit + fetch in this component, OR
            • Point action to a Next.js route handler.
          - Either way, keep this button as the primary call-to-action. */}
      <button
        type="submit"
        id="submit"
        value="clientContact"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded transition-colors"
      >
        Submit
      </button>
    </form>
  );
}









// 'use client';

// /**
//  * ContactFormComponent (radio buttons restyled to match Signup)
//  * -------------------------------------------------------------
//  * What changed (UI only):
//  * - Replaced FontAwesome icon-based radios with native radios styled exactly like
//  *   the Signup form: inline-flex, small gap, label text, and the browser’s radio control.
//  * - Kept the same "selected" state and handleRadioChange() handler—wiring is unchanged.
//  *
//  * What didn’t change:
//  * - Field names/ids, validation, and all other logic remain identical.
//  * - No submission wiring added (form still uses action="#" and does not send email).
//  *
//  * Why native radios:
//  * - Signup form uses standard radios with simple labels, so we mirror that for consistency.
//  * - Improves accessibility (native focus/keyboard handling) and reduces dependency on icons.
//  */

// import { useState } from 'react';
// import { emailRegex, suggestDomain } from "@/utils/emailValidation";

// export default function ContactFormComponent() {
//   // State to track which radio button is selected (UNCHANGED)
//   const [selected, setSelected] = useState<'email' | 'mobile' | 'textMessage' | ''>('');

//   // State to store the user's mobile number input (restricted to 10 digits) (UNCHANGED)
//   const [mobileNumber, setMobileNumber] = useState('');

//   // State to store the user's email input (UNCHANGED)
//   const [email, setEmail] = useState('');

//   // Handler for radio button change (UNCHANGED)
//   const handleRadioChange = (value: 'email' | 'mobile' | 'textMessage') => {
//     setSelected(value);
//   };

//   return (
//     /**
//      * We keep the same white card and layout used earlier so the component continues
//      * to visually align with the Signup form shell (rounded, shadow, padding).
//      * Only the radio controls below are changed to the Signup style.
//      */
//     <form
//       action="#"
//       method="post"
//       className="w-full max-w-xl bg-white rounded-xl shadow p-6 space-y-4 my-5"
//     >
//       {/* Name Input (logic unchanged) */}
//       <div>
//         <label htmlFor="name" className="block text-sm font-medium mb-1">
//           Name
//         </label>
//         <input
//           type="text"
//           name="name"
//           id="name"
//           className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
//           required
//           autoFocus
//         />
//       </div>

//       {/* Mobile Input (logic unchanged — keeps numeric-only and 10 digit max) */}
//       <div>
//         <label htmlFor="mobileNumber" className="block text-sm font-medium mb-1">
//           Mobile
//         </label>
//         <input
//           type="tel"
//           name="mobileNumber"
//           id="mobileNumber"
//           value={mobileNumber}
//           onChange={(e) => {
//             // allow only numbers and enforce max length (UNCHANGED)
//             const value = e.target.value.replace(/\D/g, '').slice(0, 10);
//             setMobileNumber(value);
//           }}
//           className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring text-gray-900
//             ${mobileNumber.length === 10
//               ? 'border-green-500 focus:ring-green-200'
//               : 'border-red-500 focus:ring-red-200'}`}
//           required
//           placeholder="04XX XXX XXX"
//           maxLength={10}
//         />
//       </div>

//       {/* Phone Input (logic unchanged) */}
//       <div>
//         <label htmlFor="phoneNumber" className="block text-sm font-medium mb-1">
//           Phone
//         </label>
//         <input
//           type="tel"
//           name="phoneNumber"
//           id="phoneNumber"
//           className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
//           required
//           placeholder="Optional"
//         />
//       </div>

//       {/* Email Input (logic unchanged — validation + suggestion UI retained) */}
//       <div>
//         <label htmlFor="contactEmail" className="block text-sm font-medium mb-1">
//           Email
//         </label>
//         <input
//           type="email"
//           name="email"
//           id="email"
//           value={email}
//           onChange={(e) => setEmail(e.target.value.trim())}
//           className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring text-gray-900
//             ${emailRegex.test(email)
//               ? 'border-green-500 focus:ring-green-200'
//               : 'border-red-500 focus:ring-red-200'}`}
//           required
//           placeholder="you@example.com"
//           autoComplete="email"
//           inputMode="email"
//         />
//         {/* Suggestion banner (UNCHANGED, adjusted to white card colors) */}
//         {!emailRegex.test(email) && suggestDomain(email) && (
//           <div className="flex items-center space-x-2 mt-1 text-yellow-700 text-sm">
//             <span>
//               Did you mean <strong>{suggestDomain(email)}</strong>?
//             </span>
//             <button
//               type="button"
//               onClick={() => setEmail(suggestDomain(email)!)}
//               className="ml-2 px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
//             >
//               ✅ Use this
//             </button>
//           </div>
//         )}
//       </div>

//       {/* Message Textarea (logic unchanged) */}
//       <div>
//         <label htmlFor="message" className="block text-sm font-medium mb-1">
//           Your Message
//         </label>
//         <textarea
//           name="message"
//           id="message"
//           className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200 resize-y min-h-[120px] text-gray-900"
//           placeholder="Write your message here..."
//         />
//       </div>

//       {/* Preferred contact method — Radios restyled to match Signup (UI ONLY) */}
//       <fieldset className="my-2 border-0 p-0 m-0">
//         {/* Use the same legend/label sizing as Signup */}
//         <legend className="block text-sm font-medium mb-2">Preferred contact method</legend>

//         <div className="flex items-center gap-6">
//           {/* Email (native radio like Signup) */}
//           <label className="inline-flex items-center gap-2">
//             <input
//               type="radio"
//               name="preferredContact"
//               value="email"
//               checked={selected === 'email'}
//               onChange={() => handleRadioChange('email')}
//             />
//             <span className="text-sm text-gray-700">Email</span>
//           </label>

//           {/* Mobile (native radio like Signup) */}
//           <label className="inline-flex items-center gap-2">
//             <input
//               type="radio"
//               name="preferredContact"
//               value="mobile"
//               checked={selected === 'mobile'}
//               onChange={() => handleRadioChange('mobile')}
//             />
//             <span className="text-sm text-gray-700">Mobile</span>
//           </label>

//           {/* Text Message (native radio like Signup) */}
//           <label className="inline-flex items-center gap-2">
//             <input
//               type="radio"
//               name="preferredContact"
//               value="textMessage"
//               checked={selected === 'textMessage'}
//               onChange={() => handleRadioChange('textMessage')}
//             />
//             <span className="text-sm text-gray-700">Text Message</span>
//           </label>
//         </div>
//       </fieldset>

//       {/* Submit button (unchanged intent; matches primary button styling) */}
//       <button
//         type="submit"
//         id="submit"
//         value="clientContact"
//         className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded transition-colors"
//       >
//         Submit
//       </button>
//     </form>
//   );
// }

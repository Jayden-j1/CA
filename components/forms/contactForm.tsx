'use client';

/**
 * ContactFormComponent (radio buttons restyled to match Signup)
 * -------------------------------------------------------------
 * What changed (UI only):
 * - Replaced FontAwesome icon-based radios with native radios styled exactly like
 *   the Signup form: inline-flex, small gap, label text, and the browser’s radio control.
 * - Kept the same "selected" state and handleRadioChange() handler—wiring is unchanged.
 *
 * What didn’t change:
 * - Field names/ids, validation, and all other logic remain identical.
 * - No submission wiring added (form still uses action="#" and does not send email).
 *
 * Why native radios:
 * - Signup form uses standard radios with simple labels, so we mirror that for consistency.
 * - Improves accessibility (native focus/keyboard handling) and reduces dependency on icons.
 */

import { useState } from 'react';
import { emailRegex, suggestDomain } from "@/utils/emailValidation";

export default function ContactFormComponent() {
  // State to track which radio button is selected (UNCHANGED)
  const [selected, setSelected] = useState<'email' | 'mobile' | 'textMessage' | ''>('');

  // State to store the user's mobile number input (restricted to 10 digits) (UNCHANGED)
  const [mobileNumber, setMobileNumber] = useState('');

  // State to store the user's email input (UNCHANGED)
  const [email, setEmail] = useState('');

  // Handler for radio button change (UNCHANGED)
  const handleRadioChange = (value: 'email' | 'mobile' | 'textMessage') => {
    setSelected(value);
  };

  return (
    /**
     * We keep the same white card and layout used earlier so the component continues
     * to visually align with the Signup form shell (rounded, shadow, padding).
     * Only the radio controls below are changed to the Signup style.
     */
    <form
      action="#"
      method="post"
      className="w-full max-w-xl bg-white rounded-xl shadow p-6 space-y-4 my-5"
    >
      {/* Name Input (logic unchanged) */}
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

      {/* Mobile Input (logic unchanged — keeps numeric-only and 10 digit max) */}
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
            // allow only numbers and enforce max length (UNCHANGED)
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

      {/* Phone Input (logic unchanged) */}
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

      {/* Email Input (logic unchanged — validation + suggestion UI retained) */}
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
        {/* Suggestion banner (UNCHANGED, adjusted to white card colors) */}
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

      {/* Message Textarea (logic unchanged) */}
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

      {/* Preferred contact method — Radios restyled to match Signup (UI ONLY) */}
      <fieldset className="my-2 border-0 p-0 m-0">
        {/* Use the same legend/label sizing as Signup */}
        <legend className="block text-sm font-medium mb-2">Preferred contact method</legend>

        <div className="flex items-center gap-6">
          {/* Email (native radio like Signup) */}
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

          {/* Mobile (native radio like Signup) */}
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

          {/* Text Message (native radio like Signup) */}
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

      {/* Submit button (unchanged intent; matches primary button styling) */}
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

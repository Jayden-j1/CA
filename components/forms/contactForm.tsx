'use client';

import { useState } from 'react';
import { emailRegex, suggestDomain } from "@/utils/emailValidation"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faCircleDot } from '@fortawesome/free-solid-svg-icons';

// --- Email validation helpers ---
// Regex for flexible email validation
// - Supports custom domains
// - Requires at least one dot in domain
// - TLD must be 2–15 characters long


// Common email domains to suggest if typos are detected
const commonDomains = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "protonmail.com",
  "aol.com",
  "live.com"
];

// Levenshtein distance algorithm (edit distance)
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}


export default function ContactFormComponent() {
  // State to track which radio button is selected
  const [selected, setSelected] = useState<'email' | 'mobile' | 'textMessage' | ''>('');

  // State to store the user's mobile number input (restricted to 10 digits)
  const [mobileNumber, setMobileNumber] = useState('');

  // State to store the user's email input
  const [email, setEmail] = useState('');

  // Handler for radio button change
  const handleRadioChange = (value: 'email' | 'mobile' | 'textMessage') => {
    setSelected(value);
  };

  return (
    <form
      action="#"
      method="post"
      className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
    >
      {/* Name Input */}
      <label htmlFor="name" className="text-left text-white font-bold text-sm tracking-wide md:text-base">
        Name
      </label>
      <input
        type="text"
        name="name"
        id="name"
        className="block w-full border-white border-2 rounded-2xl px-4 py-3
          focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
          bg-transparent text-white placeholder-white"
        required
        autoFocus
      />

      {/* Mobile Input */}
      <label htmlFor="mobileNumber" className="text-left text-white font-bold text-sm tracking-wide md:text-base">
        Mobile
      </label>
      <input
        type="tel"
        name="mobileNumber"
        id="mobileNumber"
        value={mobileNumber}
        onChange={(e) => {
          // allow only numbers and enforce max length
          const value = e.target.value.replace(/\D/g, '').slice(0, 10);
          setMobileNumber(value);
        }}
        className={`block w-full border-2 rounded-2xl px-4 py-3
          focus:outline-none focus:border-4 text-sm md:text-base
          bg-transparent text-white placeholder-white
          ${mobileNumber.length === 10 ? 'border-green-500' : 'border-red-500'}`}
        required
        placeholder='04XX XXX XXX'
        maxLength={10}
      />

      {/* Phone Input */}
      <label htmlFor="phoneNumber" className="text-left text-white font-bold text-sm tracking-wide md:text-base">
        Phone
      </label>
      <input
        type="tel"
        name="phoneNumber"
        id="phoneNumber"
        className="block w-full border-white border-2 rounded-2xl px-4 py-3
          focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
          bg-transparent text-white placeholder-white"
        required
        placeholder='Optional'
      />

      {/* Email Input */}
      <label htmlFor="contactEmail" className="text-left text-white font-bold text-sm tracking-wide md:text-base">
        Email
      </label>
      <input
        type="email"
        name="email"
        id="email"
        value={email}
        onChange={(e) => setEmail(e.target.value.trim())}
        className={`block w-full border-2 rounded-2xl px-4 py-3
          focus:outline-none focus:border-4 text-sm md:text-base
          bg-transparent text-white placeholder-white
          ${emailRegex.test(email) ? 'border-green-500' : 'border-red-500'}`}
        required
        placeholder="you@example.com"
        autoComplete="email"
        inputMode="email"
      />
      {/* Show suggestion with "✅ Use this" button */}
      {!emailRegex.test(email) && suggestDomain(email) && (
        <div className="flex items-center space-x-2 mt-1 text-yellow-400 text-sm">
          <span>Did you mean <strong>{suggestDomain(email)}</strong>?</span>
          <button
            type="button"
            onClick={() => setEmail(suggestDomain(email)!)}
            className="ml-2 px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
          >
            ✅ Use this
          </button>
        </div>
      )}

      {/* Message Textarea */}
      <label htmlFor="message" className="text-left text-white font-bold text-sm tracking-wide md:text-base">
        Your Message
      </label>
      <textarea
        name="message"
        id="message"
        className="block w-full border-white border-2 rounded-2xl px-4 py-3
          focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
          bg-transparent text-white placeholder-white resize-y min-h-[120px]"
        placeholder="Write your message here..."
      />

      {/* Preferred contact method */}
      {/* ... unchanged radio buttons ... */}

      {/* Submit button */}
      <button
        type="submit"
        id="submit"
        value="clientContact"
        className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-4xl shadow-2xl border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer"
      >
        Submit
      </button>
    </form>
  );
}










// 'use client';

// import { useState } from 'react';
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// import { faCircle, faCircleDot } from '@fortawesome/free-solid-svg-icons';

// export default function ContactFormComponent() {
//   // State to track which radio button is selected
//   const [selected, setSelected] = useState<'email' | 'mobile' | 'textMessage' | ''>('');

//   // State to store the user's mobile number input (restricted to 10 digits)
//   const [mobileNumber, setMobileNumber] = useState('');


//   // Handler for radio button change
//   const handleRadioChange = (value: 'email' | 'mobile' | 'textMessage') => {
//     setSelected(value);
//   };

//   return (
//     <form
//       action="#"
//       method="post"
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
//       {/* Name Input */}
//       <label
//         htmlFor="name"
//         className="text-left text-white font-bold text-sm tracking-wide md:text-base"
//       >
//         Name
//       </label>
//       <input
//         type="text"
//         name="name"
//         id="name"
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3
//           focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
//           bg-transparent text-white placeholder-white"
//         required
//         autoFocus
//       />

//       {/* Mobile Input */}
//       <label
//         htmlFor="mobileNumber"
//         className="text-left text-white font-bold text-sm tracking-wide md:text-base"
//       >
//         Mobile
//       </label>
//       <input
//         type="tel"
//         name="mobileNumber"
//         id="mobileNumber"
//         value={mobileNumber}
//         onChange={(e) => {
//           // allow only numbers and enforce max length
//           const value = e.target.value.replace(/\D/g, '').slice(0, 10);
//           setMobileNumber(value);
//         }}
//         className={`block w-full border-2 rounded-2xl px-4 py-3
//           focus:outline-none focus:border-4 text-sm md:text-base
//           bg-transparent text-white placeholder-white
//           ${mobileNumber.length === 10 ? 'border-green-500' : 'border-red-500'}`}
//         required
//         placeholder='04XX XXX XXX'
//         maxLength={10}
//       />

//       {/* Phone Input */}
//       <label
//         htmlFor="phoneNumber"
//         className="text-left text-white font-bold text-sm tracking-wide md:text-base"
//       >
//         Phone
//       </label>
//       <input
//         type="tel"
//         name="phoneNumber"
//         id="phoneNumber"
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3
//           focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
//           bg-transparent text-white placeholder-white"
//         required
//         placeholder='Optional'
//       />

//       {/* Email Input */}
//       <label
//         htmlFor="contactEmail"
//         className="text-left text-white font-bold text-sm tracking-wide md:text-base"
//       >
//         Email
//       </label>
//       <input
//         type="email"
//         name="email"
//         id="email"
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3
//           focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
//           bg-transparent text-white placeholder-white"
//         required
//       />

//       {/* Message Textarea */}
//       <label
//         htmlFor="message"
//         className="text-left text-white font-bold text-sm tracking-wide md:text-base"
//       >
//         Your Message
//       </label>
//       <textarea
//         name="message"
//         id="message"
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3
//           focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
//           bg-transparent text-white placeholder-white resize-y min-h-[120px]"
//         placeholder="Write your message here..."
//       />

//       {/* Preferred contact method */}
//       <fieldset className="flex flex-col space-y-3 mt-4 border-0 p-0 m-0">
//         <legend className="text-left text-white font-bold text-sm tracking-wide md:text-base px-0 mb-1">
//           Preferred contact method
//         </legend>

//         {/* Email */}
//         <label htmlFor="viaEmail" className="flex items-center cursor-pointer space-x-2">
//           <input
//             type="radio"
//             id="viaEmail"
//             name="preferredContact"
//             value="email"
//             checked={selected === 'email'}
//             onChange={() => handleRadioChange('email')}
//             className="sr-only"
//           />
//           <FontAwesomeIcon
//             icon={selected === 'email' ? faCircleDot : faCircle}
//             className={selected === 'email' ? 'text-green-500 border-2 border-white rounded-full' : 'text-white'}
//             size="lg"
//           />
//           <span className="text-left text-white font-bold text-sm tracking-wide md:text-base">
//             Email
//           </span>
//         </label>

//         {/* Mobile */}
//         <label htmlFor="viaMobile" className="flex items-center cursor-pointer space-x-2">
//           <input
//             type="radio"
//             id="viaMobile"
//             name="preferredContact"
//             value="mobile"
//             checked={selected === 'mobile'}
//             onChange={() => handleRadioChange('mobile')}
//             className="sr-only"
//           />
//           <FontAwesomeIcon
//             icon={selected === 'mobile' ? faCircleDot : faCircle}
//             className={selected === 'mobile' ? 'text-green-500 border-2 border-white rounded-full' : 'text-white'}
//             size="lg"
//           />
//           <span className="text-left text-white font-bold text-sm tracking-wide md:text-base">
//             Mobile
//           </span>
//         </label>

//         {/* Text Message */}
//         <label htmlFor="viaTextMessage" className="flex items-center cursor-pointer space-x-2">
//           <input
//             type="radio"
//             id="viaTextMessage"
//             name="preferredContact"
//             value="textMessage"
//             checked={selected === 'textMessage'}
//             onChange={() => handleRadioChange('textMessage')}
//             className="sr-only"
//           />
//           <FontAwesomeIcon
//             icon={selected === 'textMessage' ? faCircleDot : faCircle}
//             className={selected === 'textMessage' ? 'text-green-500 border-2 border-white rounded-full' : 'text-white'}
//             size="lg"
//           />
//           <span className="text-left text-white font-bold text-sm tracking-wide md:text-base">
//             Text Message
//           </span>
//         </label>
//       </fieldset>

//       {/* Submit button */}
//       <button
//         type="submit"
//         id="submit"
//         value="clientContact"
//         className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-4xl shadow-2xl border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer"
//       >
//         Submit
//       </button>
//     </form>
//   );
// }








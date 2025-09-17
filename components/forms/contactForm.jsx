'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faCircleDot } from '@fortawesome/free-solid-svg-icons';

export default function ContactFormComponent() {
  // State to track which radio button is selected
  const [selected, setSelected] = useState('');

  return (
    // Your existing form, unchanged except radios updated below
    <form
      action="#"
      method="#"
      className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
    >
      {/* Name Label and Input */}
      <label
        htmlFor="name"
        className="text-left text-white font-bold text-sm tracking-wide md:text-base"
      >
        Name
      </label>
      <input type="text" name="name" id="name" className="block w-full border-white border-2 rounded-2xl px-4 py-3
                    focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
                    bg-transparent text-white placeholder-white" required autoFocus />

      {/* Mobile Number Label and Input */}
      <label
        htmlFor="moblieNumber"
        className="text-left text-white font-bold text-sm tracking-wide md:text-base"
      >
        Mobile
      </label>
      <input type="tel" name="mobileNumber" id="mobileNumber" className="block w-full border-white border-2 rounded-2xl px-4 py-3
                    focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
                    bg-transparent text-white placeholder-white" required />

      {/* Phone Number Label and Input */}
      <label
        htmlFor="phoneNumber"
        className="text-left text-white font-bold text-sm tracking-wide md:text-base"
      >
        Phone
      </label>
      <input type="tel" name="phoneNumber" id="phoneNumber" className="block w-full border-white border-2 rounded-2xl px-4 py-3
                    focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
                    bg-transparent text-white placeholder-white" required />

      {/* Email Label and Input */}
      <label
        htmlFor="contactEmail"
        className="text-left text-white font-bold text-sm tracking-wide md:text-base"
      >
        Email
      </label>
      <input type="email" name="email" id="email" className="block w-full border-white border-2 rounded-2xl px-4 py-3
                    focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
                    bg-transparent text-white placeholder-white" required />

      {/* Text Area Input for personal messages */}
      <label
        htmlFor="message"
        className="text-left text-white font-bold text-sm tracking-wide md:text-base"
      >
        Your Message
      </label>
      <textarea name="message" id="message" className="block w-full border-white border-2 rounded-2xl px-4 py-3
        focus:outline-none focus:border-white focus:border-4
        text-sm md:text-base
        bg-transparent
        text-white
        placeholder-white
        resize-y
        min-h-[120px]"
        placeholder="Write your message here..."></textarea>

      {/* Preferred method of contact radio buttons */}
      <div className="flex flex-col space-y-3 mt-4">
        {/* Email option */}
        <label
          htmlFor="viaEmail"
          className="flex items-center cursor-pointer space-x-2"
        >
          {/* Hidden radio input */}
          <input
            type="radio"
            id="viaEmail"
            name="preferredContact"
            value="email"
            checked={selected === 'email'}
            onChange={() => setSelected('email')}
            className="sr-only"
          />
          {/* Icon: green if selected, white if not */}
          <FontAwesomeIcon
            icon={selected === 'email' ? faCircleDot : faCircle}
            className={selected === 'email' ? 'text-green-500 border-2 border-white rounded-full' : 'text-white'}
            size="lg"
          />
          {/* Label text */}
          <span className="text-left text-white font-bold text-sm tracking-wide md:text-base">
            Email
          </span>
        </label>

        {/* Mobile option */}
        <label
          htmlFor="viaMobile"
          className="flex items-center cursor-pointer space-x-2"
        >
          <input
            type="radio"
            id="viaMobile"
            name="preferredContact"
            value="mobile"
            checked={selected === 'mobile'}
            onChange={() => setSelected('mobile')}
            className="sr-only"
          />
          <FontAwesomeIcon
            icon={selected === 'mobile' ? faCircleDot : faCircle}
            className={selected === 'mobile' ? 'text-green-500 border-2 border-white rounded-full' : 'text-white'}
            size="lg"
          />
          <span className="text-left text-white font-bold text-sm tracking-wide md:text-base">
            Mobile
          </span>
        </label>

        {/* Text Message option */}
        <label
          htmlFor="viaTextMessage"
          className="flex items-center cursor-pointer space-x-2"
        >
          <input
            type="radio"
            id="viaTextMessage"
            name="preferredContact"
            value="textMessage"
            checked={selected === 'textMessage'}
            onChange={() => setSelected('textMessage')}
            className="sr-only"
          />
          <FontAwesomeIcon
            icon={selected === 'textMessage' ? faCircleDot : faCircle}
            className={
              selected === 'textMessage' ? 'text-green-500 border-2 border-white rounded-full' : 'text-white'
            }
            size="lg"
          />
          <span className="text-left text-white font-bold text-sm tracking-wide md:text-base">
            Text Message
          </span>
        </label>
      </div>

      <button type="submit" id="submit" value="clientContact">
        {/* You might want to add text or styling here */}
      </button>
    </form>
  );
}













// 'use client';
// import { useState } from 'react';
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// import { faCircle, faCircleDot } from '@fortawesome/free-solid-svg-icons';


// export default function ContactFormComponent() {

//     // State to track selected radio
//     const [selected, setSelected] = useState('');

//     // Helper function to render a radio option
//     const RadioOption = ({ id, label }) => {
//     const isChecked = selected === id;

//     return (
//         // Form
//         <form action="#" method="#" className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]">

//             {/* Name Label and Input */}
//             <label htmlFor="name" className="text-left text-white font-bold text-sm tracking-wide md:text-base">Name</label>
//             <input type="text" name="name" id="name" required autoFocus/>


//             {/* Mobile Number Label and Input */}
//             <label htmlFor="moblieNumber" className="text-left text-white font-bold text-sm tracking-wide md:text-base">Mobile</label>
//             <input type="tel" name="mobileNumber" id="mobileNumber" required/>

//             {/* Phone Number Label and Input */}
//             <label htmlFor="phoneNumber" className="text-left text-white font-bold text-sm tracking-wide md:text-base">Phone</label>
//             <input type="tel" name="phoneNumber" id="phoneNumber" required/>

//             {/* Email Label and Input */}
//             <label htmlFor="contactEmail" className="text-left text-white font-bold text-sm tracking-wide md:text-base">Email</label>
//             <input type="emai" name="email" id="email" required/>

//             {/* Text Area Input for personal messages */}
//             <label htmlFor="message" className="text-left text-white font-bold text-sm tracking-wide md:text-base">Your Message</label>
//             <textarea name="message" id="message"></textarea>

//             {/* Preferred method of contact radio buttons */}
//             <div>
//                 <label htmlFor="viaEmail" className="text-left text-white font-bold text-sm tracking-wide md:text-base">Email</label>
//                     <input type="radio" />

//                 <label htmlFor="viaMobile" className="text-left text-white font-bold text-sm tracking-wide md:text-base">Mobile</label>
//                     <input type="radio" />

//                 <label htmlFor="viaTextMessage" className="text-left text-white font-bold text-sm tracking-wide md:text-base">Text Message</label>
//                     <input type="radio" />
//             </div>

//             <button type="submit" id="submit" value="clientContact">

//             </button>


//         </form>
//     );
// }
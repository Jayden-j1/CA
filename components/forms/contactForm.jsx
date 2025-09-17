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
      <fieldset className="flex flex-col space-y-3 mt-4 border-0 p-0 m-0">
      <legend className="text-left text-white font-bold text-sm tracking-wide md:text-base px-0 mb-1">
      
      <div className="flex flex-col space-y-3 mt-4">
        {/* Preferred method of contact */}
        <p className='className="text-left text-white font-bold text-sm tracking-wide md:text-base'>Preferred contact method</p>

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
      
      </legend>
      </fieldset>
      <button type="submit" id="submit" value="clientContact" className="px-8 py-4 bg-green-600 text-white hover:bg-green-500     font-bold rounded-4xl shadow-2xl 
      border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer">
        Submit
      </button>
    </form>
  );
}














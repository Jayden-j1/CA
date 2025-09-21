// Needed to use hooks in Next.js router
'use client';

import { ReactNode } from "react";

// ---------------------------
// 1. Define Props with Types
// ---------------------------

// We explicitly type each prop so they’re predictable and safe.
interface PopUpMessageProps {
  isOpen: boolean;        // Controls whether the modal is visible
  onClose: () => void;    // Function that closes the modal
  heading: string;        // Title text of the modal
  message: string | ReactNode; // Content of the modal (can be plain text or JSX)
}

// ---------------------------
// 2. Functional Component
// ---------------------------

export default function PopUpMessage({
  isOpen,
  onClose,
  heading,
  message,
}: PopUpMessageProps) {
  // If modal is not open, render nothing
  if (!isOpen) return null;

  return (
    <>
      {/* Background Overlay */}
      <div className="fixed inset-0 z-50 flex justify-center items-center bg-gradient-to-b from-blue-700 to-blue-300 bg-opacity-60">
        
        {/* Modal Box */}
        <div className="bg-white text-black rounded-lg shadow-lg max-w-lg w-full p-6 mx-4 relative">
          
          {/* Modal Heading */}
          <h2 className="text-xl font-semibold mb-4">{heading}</h2>

          {/* Modal Message */}
          <p className="mb-6 text-gray-800">{message}</p>

          {/* Close Button */}
          <div className="text-right">
            <button
              onClick={onClose} // Fires the close handler
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition duration-300 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}












// // Needed to use hooks in  Next.js router
// 'use client'; 


// // Modal Component (pop up message)
// export default function PopUpMessage( {isOpen, onClose, heading, message} ) {
//     // Do not render anything if modal is not open
//     if (!isOpen) return null;
//     return (
//         <>
//             {/* Background Overlay */}
//             <div className="fixed inset-0 z-50 flex justify-center items-center bg-gradient-to-b from-blue-700 to-blue-300 bg-opacity-60">

//             {/* Modal Box */}
//             <div className="bg-white text-black rounded-lg shadow-lg max-w-lg w-full p-6 mx-4 relative">

//             {/* Modal Heading */}
//             <h2 className="text-xl font-semibold mb-4">
//                 {heading}
//             </h2>

//             {/* Modal Message */}
//             <p className="mb-6 text-gray-800">{message}</p>

//             {/* Close Button */}
//             <div className="text-right">
//                 <button 
//                 onClick={onClose}
//                 className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transistion duration-300 cursor-pointer"
//                 >
//                  Close 
//                 </button>
//              </div>
//             </div>
//            </div>
//         </>
//     );
// }
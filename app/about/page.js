'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon } from '@heroicons/react/24/solid';

const words = ['CULTURE', 'COLLABORATE', 'COMMUNITY', 'RESPECT', 'TRANSPARENCY', 'AWARENESS'];

const sections = [
  {
    title: 'Understanding History',
    content: 'Learn about the deep and diverse histories of First Nations peoples, including the impact of colonisation and the importance of truth-telling.'
  },
  {
    title: 'Building Relationships',
    content: 'Effective collaboration with the local Aboriginal community starts with listening, respect, and long-term relationship-building based on trust.'
  },
  {
    title: 'Cultural Strengths',
    content: 'First Nations communities bring unique perspectives, knowledge systems, and strengths that enrich all aspects of society.'
  }
];

export default function AboutPage() {
  const [index, setIndex] = useState(0);
  const [openSections, setOpenSections] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const toggleSection = (i) => {
    setOpenSections((prev) =>
      prev.includes(i) ? prev.filter((id) => id !== i) : [...prev, i]
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 px-6 py-10 sm:px-12 sm:py-16">
      {/* Main Content */}
      <div className="col-span-1 sm:col-span-3 row-span-1 sm:row-span-2 border-2 border-gray-300 p-6 rounded-lg shadow-sm bg-white">
        <div className="h-auto sm:h-14 relative overflow-hidden mb-6 min-h-[3rem]">
          <AnimatePresence mode="wait">
            <motion.h1
              key={words[index]}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="absolute text-2xl sm:text-4xl md:text-5xl font-semibold text-gray-800 tracking-widest sm:tracking-wide whitespace-nowrap sm:whitespace-normal break-words w-full"
            >
              {words[index]}
            </motion.h1>
          </AnimatePresence>
        </div>

        <p className="text-lg sm:text-xl leading-relaxed tracking-normal sm:tracking-wide text-gray-800">
          Jingela (Hello), this website is dedicated to fostering cultural awareness, understanding, and respect for First Nations Aboriginal Peoples of Australia. It aims to support non-Indigenous individuals and organisations in learning about our rich history, diverse cultures, and enduring connection to Country. By encouraging open-mindedness and collaboration, we hope to build stronger, more respectful relationships that acknowledge and celebrate the strengths, knowledge, and resilience of our communities.
        </p>
      </div>

      {/* Placeholder Right Side */}
      <div className="col-span-1 sm:col-span-2 row-span-1 sm:row-span-2 border-2 border-gray-300 p-4 rounded-lg bg-gray-50">
        2
      </div>

      {/* Collapsible Sections */}
      <div className="col-span-1 sm:col-span-5 row-span-1 space-y-4">
        {sections.map((section, i) => {
          const isOpen = openSections.includes(i);
          const contentRef = useRef(null);

          return (
            <div
              key={i}
              className="bg-blue-500 border-2 border-black rounded-md hover:bg-blue-400 hover:shadow transition-all duration-200"
            >
              <button
                onClick={() => toggleSection(i)}
                className="w-full flex justify-between items-center p-4 text-left"
              >
                <span className="font-medium text-lg text-white tracking-wide">{section.title}</span>
                <ChevronDownIcon
                  className={`w-5 h-5 text-white transform transition-transform duration-300 ${
                    isOpen ? 'rotate-180 text-blue-100' : ''
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{
                      height: contentRef.current?.scrollHeight || 'auto',
                      opacity: 1
                    }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div
                      ref={contentRef}
                      className="px-4 pb-4 text-white text-base tracking-wide leading-relaxed"
                    >
                      {section.content}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}



// 'use client';

// import { useEffect, useRef, useState } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import { ChevronDownIcon } from '@heroicons/react/24/solid';

// const words = ['CULTURE', 'COLLABORATE', 'COMMUNITY', 'RESPECT', 'TRANSPARENCY', 'AWARENESS'];

// const sections = [
//   {
//     title: 'Understanding History',
//     content: 'Learn about the deep and diverse histories of First Nations peoples, including the impact of colonisation and the importance of truth-telling.'
//   },
//   {
//     title: 'Building Relationships',
//     content: 'Effective collaboration with the local Aboriginal community starts with listening, respect, and long-term relationship-building based on trust.'
//   },
//   {
//     title: 'Cultural Strengths',
//     content: 'First Nations communities bring unique perspectives, knowledge systems, and strengths that enrich all aspects of society.'
//   }
// ];

// export default function AboutPage() {
//   const [index, setIndex] = useState(0);
//   const [openSections, setOpenSections] = useState([]);

//   useEffect(() => {
//     const interval = setInterval(() => {
//       setIndex((prev) => (prev + 1) % words.length);
//     }, 2000);
//     return () => clearInterval(interval);
//   }, []);

//   const toggleSection = (i) => {
//     setOpenSections((prev) =>
//       prev.includes(i) ? prev.filter((id) => id !== i) : [...prev, i]
//     );
//   };

//   return (
//     <div className="grid grid-cols-5 grid-rows-5 gap-4 px-6 py-10 sm:px-12 sm:py-16">
//       {/* Main Content */}
//       <div className="col-span-3 row-span-2 border-2 border-gray-300 p-6 rounded-lg shadow-sm bg-white">
//         <div className="h-auto sm:h-14 relative overflow-hidden mb-6 min-h-[3rem]">
//           <AnimatePresence mode="wait">
//             <motion.h1
//               key={words[index]}
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               exit={{ opacity: 0, y: -20 }}
//               transition={{ duration: 0.5 }}
//               className="absolute text-2xl sm:text-4xl md:text-5xl font-semibold text-gray-800 tracking-widest sm:tracking-wide whitespace-nowrap sm:whitespace-normal break-words w-full"
//               // Responsive text: prevents cut-off, adjusts font size, wraps if needed
//             >
//               {words[index]}
//             </motion.h1>
//           </AnimatePresence>
//         </div>

//         <p className="text-lg sm:text-xl leading-relaxed tracking-normal sm:tracking-wide text-gray-800">
//           Jingela (Hello), this website is dedicated to fostering cultural awareness, understanding, and respect for First Nations Aboriginal Peoples of Australia. It aims to support non-Indigenous individuals and organisations in learning about our rich history, diverse cultures, and enduring connection to Country. By encouraging open-mindedness and collaboration, we hope to build stronger, more respectful relationships that acknowledge and celebrate the strengths, knowledge, and resilience of our communities.
//         </p>
//       </div>

//       {/* Placeholder Right Side */}
//       <div className="col-span-2 row-span-2 col-start-4 border-2 border-gray-300 p-4 rounded-lg bg-gray-50">
//         2
//       </div>

//       {/* Collapsible Sections */}
//       <div className="col-span-5 row-span-3 row-start-3 space-y-4">
//         {sections.map((section, i) => {
//           const isOpen = openSections.includes(i);
//           const contentRef = useRef(null);

//           return (
//             <div
//               key={i}
//               className="bg-blue-500 border-2 border-black rounded-md hover:bg-blue-400 hover:shadow transition-all duration-200"
//             >
//               <button
//                 onClick={() => toggleSection(i)}
//                 className="w-full flex justify-between items-center p-4 text-left"
//               >
//                 <span className="font-medium text-lg text-white tracking-wide">{section.title}</span>
//                 <ChevronDownIcon
//                   className={`w-5 h-5 text-white transform transition-transform duration-300 ${
//                     isOpen ? 'rotate-180 text-blue-100' : ''
//                   }`}
//                 />
//               </button>

//               <AnimatePresence initial={false}>
//                 {isOpen && (
//                   <motion.div
//                     initial={{ height: 0, opacity: 0 }}
//                     animate={{
//                       height: contentRef.current?.scrollHeight || 'auto',
//                       opacity: 1
//                     }}
//                     exit={{ height: 0, opacity: 0 }}
//                     transition={{ duration: 0.3, ease: 'easeInOut' }}
//                     className="overflow-hidden"
//                   >
//                     <div
//                       ref={contentRef}
//                       className="px-4 pb-4 text-white text-base tracking-wide leading-relaxed"
//                       // ✅ White content text with better spacing
//                     >
//                       {section.content}
//                     </div>
//                   </motion.div>
//                 )}
//               </AnimatePresence>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }

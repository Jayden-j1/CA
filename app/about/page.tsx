'use client';

import { useEffect, useRef, useState, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon } from '@heroicons/react/24/solid';
import TopofPageContent from '../../components/topPage/topOfPageStyle';
import Image from 'next/image';
import PopUpMessage from '../../components/PopUpMsgs/popUpTemplate';

const words: string[] = ['CULTURE', 'COLLABORATE', 'COMMUNITY', 'RESPECT', 'TRANSPARENCY', 'AWARENESS'];

interface Section {
  title: string;
  content: string;
}

const sections: Section[] = [
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
  const [isModalOpen, setModalOpen] = useState<boolean>(false);

  // Open pop-up modal
  const openAbout = (e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    e.preventDefault(); // prevent navigation
    setModalOpen(true);
  };

  const closeAbout = () => setModalOpen(false);

  const title = "Developed by Community, Guided by Knowledge Holders";
  const message =
    "This website has been 100% developed by members of the local Aboriginal community, with all content respectfully shared by recognised Elders and cultural knowledge holders. It serves as a trusted source of truth for those seeking to deepen their understanding of local Aboriginal culture, history, and practices. Every element reflects lived experience, community voice, and cultural integrity.";

  const [index, setIndex] = useState<number>(0);
  const [openSections, setOpenSections] = useState<number[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const toggleSection = (i: number) => {
    setOpenSections((prev) => (prev.includes(i) ? prev.filter((id) => id !== i) : [...prev, i]));
  };

  return (
    <>
      <TopofPageContent
        HeadingOneTitle="About"
        paragraphContent="Jingela (Hello), this website is dedicated to fostering cultural awareness, understanding, and respect for First Nations Peoples of Australia."
        linkOne="See more"
        onClick={openAbout}
        imageSrc="/images/sea eagle logo.png"
        imageAlt="Aborinal style image of an Eagle"
      />

      <PopUpMessage heading={title} message={message} isOpen={isModalOpen} onClose={closeAbout} />

      <div className="flex flex-col xl:grid xl:grid-cols-5 gap-7 px-6 py-10 xl:px-12 xl:py-16">
        <div className="col-span-1 md:col-span-3 row-span-1 md:row-span-2 border-2 border-gray-300 p-6 rounded-lg shadow-xl bg-blue-500">
          <div className="h-auto sm:h-14 relative overflow-hidden mb-6 min-h-[3rem]">
            <AnimatePresence mode="wait">
              <motion.h1
                key={words[index]}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="absolute text-2xl sm:text-4xl md:text-5xl font-bold text-white tracking-widest sm:tracking-wide whitespace-nowrap sm:whitespace-normal break-words w-full"
              >
                {words[index]}
              </motion.h1>
            </AnimatePresence>
          </div>

          <p className="text-lg sm:text-xl leading-relaxed tracking-normal sm:tracking-wide text-white font-semibold mb-5">
            <span className="italic px-2 py-4 bg-green-500 rounded-4xl">We aim to:</span>
          </p>
          <ul className="list-disc pl-4">
            <li className="text-white mb-2">
              Support non-Indigenous people and organisations in learning about Indigenous history, cultures, and connection to Country
            </li>
            <li className="text-white mb-2">Promote open-mindedness and collaboration</li>
            <li className="text-white mb-2">Foster respectful, stronger relationships</li>
            <li className="text-white mb-2">Acknowledge and celebrate Indigenous strengths, knowledge, and resilience</li>
          </ul>
        </div>

        <div className="aspect-video col-span-1 md:col-span-2 row-span-1 md:row-span-2 border-2 border-gray-300 p-4 rounded-lg bg-gray-50 relative shadow-2xl">
          <Image src="/images/Cabbage_Tree_Island.jpg" alt="Image of Cabbage Tree Island" fill className="object-cover rounded-md absolute" />
        </div>

        <div className="col-span-1 md:col-span-5 row-span-1 space-y-4">
          {sections.map((section, i) => {
            const isOpen = openSections.includes(i);
            const contentRef = useRef<HTMLDivElement>(null);

            return (
              <div
                key={i}
                className="bg-blue-500 shadow-2xl rounded-md hover:bg-blue-400 hover:shadow transition-all duration-200"
              >
                <button onClick={() => toggleSection(i)} className="w-full flex justify-between items-center p-4 text-left cursor-pointer">
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
                      <div ref={contentRef} className="px-4 pb-4 text-white text-base tracking-wide leading-relaxed">
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
    </>
  );
}









// 'use client';

// import { useEffect, useRef, useState } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import { ChevronDownIcon } from '@heroicons/react/24/solid';
// import TopofPageContent from '../../components/topPage/topOfPageStyle';
// import Image from 'next/image';
// import PopUpMessage from '../../components/PopUpMsgs/popUpTemplate';



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

//   // State to control pop-up message visibility
//   const [isModalOpen, setModelOpen] = useState();
  
//   // Function to open pop-up message
//   const openAbout = (e) => {
//     // Prevent link from navigating else where
//     e.preventDefault 
//     // Set pop-up modal to true (open and display message)
//     setModelOpen(true);
//   }

//   // Function to close and hide pop-up about message
//   const closeAbout = () => {
//     setModelOpen(false);
//   }

//   // Heading for about page pop-up
//   const title = "Developed by Community, Guided by Knowledge Holders";

//   // Paragraph content for about page pop-up
//   const message = "This website has been 100% developed by members of the local Aboriginal community, with all content respectfully shared by recognised Elders and cultural knowledge holders. It serves as a trusted source of truth for those seeking to deepen their understanding of local Aboriginal culture, history, and practices. Every element reflects lived experience, community voice, and cultural integrity.";


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
//     <>
//     <TopofPageContent 
//       HeadingOneTitle="About"
//       paragraphContent="Jingela (Hello), this website is dedicated to fostering cultural awareness, understanding, and respect for First Nations Peoples of Australia."
//       linkOne="See more"
//       onClick={openAbout}
//     />

//     {/* Pop up message for About Page*/}
//     <PopUpMessage 
//       heading={title}
//       message={message}
//       isOpen={isModalOpen}
//       onClose={closeAbout}
//     />

//   <div className="flex flex-col xl:grid xl:grid-cols-5 gap-7 px-6 py-10 xl:px-12 xl:py-16">
//   {/* Main Content */}
//   <div className="col-span-1 md:col-span-3 row-span-1 md:row-span-2 border-2 border-gray-300 p-6 rounded-lg shadow-xl bg-blue-500">
//     <div className="h-auto sm:h-14 relative overflow-hidden mb-6 min-h-[3rem]">
//       <AnimatePresence mode="wait">
//         <motion.h1
//           key={words[index]}
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           exit={{ opacity: 0, y: -20 }}
//           transition={{ duration: 0.5 }}
//           className="absolute text-2xl sm:text-4xl md:text-5xl font-bold text-white tracking-widest sm:tracking-wide whitespace-nowrap sm:whitespace-normal break-words w-full"
//         >
//           {words[index]}
//         </motion.h1>
//       </AnimatePresence>
//     </div>

//     <p className="text-lg sm:text-xl leading-relaxed tracking-normal sm:tracking-wide text-white font-semibold mb-5">
//       <span className="italic px-2 py-4 bg-green-500 rounded-4xl">We aim to:</span> 
//     </p>
//       <ul className="list-disc pl-4">
//         <li className="text-white mb-2">
//           Support non-Indigenous people and organisations in learning about Indigenous history, cultures, and connection to Country
//         </li>
//         <li className="text-white mb-2">Promote open-mindedness and collaboration</li>
//         <li className="text-white mb-2">Foster respectful, stronger relationships</li>
//         <li className="text-white mb-2">Acknowledge and celebrate Indigenous strengths, knowledge, and resilience</li>
//       </ul>
//   </div>

//   <div className="aspect-video col-span-1 md:col-span-2 row-span-1 md:row-span-2 border-2 border-gray-300 p-4 rounded-lg bg-gray-50 
//   relative shadow-2xl">
//     <Image 
//       src="/images/Cabbage_Tree_Island.jpg"
//       alt="Image of Cabbage Tree Island"
//       fill
//       className="object-cover rounded-md absolute"
//     />
//   </div>

//   {/* Collapsible Sections */}
//   <div className="col-span-1 md:col-span-5 row-span-1 space-y-4">
//     {sections.map((section, i) => {
//       const isOpen = openSections.includes(i);
//       const contentRef = useRef(null);

//       return (
//         <div
//           key={i}
//           className="bg-blue-500 shadow-2xl rounded-md hover:bg-blue-400 hover:shadow transition-all duration-200"
//         >
//           <button
//             onClick={() => toggleSection(i)}
//             className="w-full flex justify-between items-center p-4 text-left"
//           >
//             <span className="font-medium text-lg text-white tracking-wide">{section.title}</span>
//             <ChevronDownIcon
//               className={`w-5 h-5 text-white transform transition-transform duration-300 ${
//                 isOpen ? 'rotate-180 text-blue-100' : ''
//               }`}
//             />
//           </button>

//           <AnimatePresence initial={false}>
//             {isOpen && (
//               <motion.div
//                 initial={{ height: 0, opacity: 0 }}
//                 animate={{
//                   height: contentRef.current?.scrollHeight || 'auto',
//                   opacity: 1
//                 }}
//                 exit={{ height: 0, opacity: 0 }}
//                 transition={{ duration: 0.3, ease: 'easeInOut' }}
//                 className="overflow-hidden"
//               >
//                 <div
//                   ref={contentRef}
//                   className="px-4 pb-4 text-white text-base tracking-wide leading-relaxed"
//                 >
//                   {section.content}
//                 </div>
//               </motion.div>
//             )}
//           </AnimatePresence>
//         </div>  
//     );
//     })}
//   </div>
// </div>
// </>
//   );
// }

import { motion, AnimatePresence } from "framer-motion";
import Btn from "@/components/Button/button";
import { useState } from "react";

// Define the props interface for Section1
interface Section1Props {
  bundjalungGreeting?: string; // Optional Bundjalung greeting
  englishGreeting?: string;    // Optional English greeting
  className?: string;          // Optional CSS class for custom styling
}

export default function Section1({
  bundjalungGreeting = "JINGI WALLA",
  englishGreeting = "WELCOME",
  className = "",
}: Section1Props) {
  // State to toggle between Bundjalung and English greeting
  const [isBundjalung, setIsBundjalung] = useState(true);

  // Function to toggle greeting
  const toggleGreeting = () => setIsBundjalung((prev) => !prev);

  return (
    <section
      className={`flex flex-col justify-center items-center w-full min-h-[75vh] sm:min-h-screen px-4 bg-cover bg-center mt-40 ${className}`}
      style={{ backgroundImage: `url('images/Diversity.jpg')` }}
    >
      {/* Animate greeting with fade in/out */}
      <AnimatePresence mode="wait">
        <motion.h1
          key={isBundjalung ? "bundjalung" : "english"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="text-center w-full font-extrabold text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl mb-6 text-white drop-shadow-lg text-shadow-black-lg"
        >
          {isBundjalung ? bundjalungGreeting : englishGreeting}
        </motion.h1>
      </AnimatePresence>

      {/* Translate button */}
      <Btn
        label="Translate"
        aria-label="Translate greeting between Bundjalung and English"
        onClick={toggleGreeting}
        whileHover={{ scale: 1.05, y: -4 }}
        whileTap={{ scale: 0.95, y: 2 }}
        className="text-xl sm:text-2xl md:text-3xl px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 border-white border-2 text-white rounded-full shadow-2xl transition-colors duration-300 hover:bg-green-500 tracking-tight cursor-pointer"
      />
    </section>
  );
}











// import { motion, AnimatePresence } from "framer-motion";
// import Btn from "@/components/Button/button";
// import { useState } from "react";

// // ---------------------------
// // 1. Define Props with Types
// // ---------------------------

// // We define the props that Section1 accepts.
// // Both greetings are optional (default values are provided in the component).
// interface Section1Props {
//   bundjalungGreeting?: string;
//   englishGreeting?: string;
// }

// // ---------------------------
// // 2. Functional Component
// // ---------------------------

// export default function Section1({
//   bundjalungGreeting = "JINGI WALLA", // default if not passed
//   englishGreeting = "WELCOME",        // default if not passed
// }: Section1Props) {
//   // A boolean state: true = show Bundjalung greeting, false = show English greeting
//   const [isBundjalung, setIsBundjalung] = useState<boolean>(true);

//   // Toggle function flips the greeting
//   const toggleGreeting = (): void => setIsBundjalung((prev) => !prev);

//   // ---------------------------
//   // 3. Render JSX
//   // ---------------------------
//   return (
//     <section
//       className="flex flex-col justify-center items-center w-full min-h-[75vh] sm:min-h-screen px-4 bg-cover bg-center mt-40"
//       style={{ backgroundImage: `url('images/Diversity.jpg')` }}
//     >
//       {/* AnimatePresence ensures smooth transition when greeting changes */}
//       <AnimatePresence mode="wait">
//         <motion.h1
//           key={isBundjalung ? "bundjalung" : "english"} // forces re-render on language change
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           transition={{ duration: 1 }}
//           className="text-center w-full font-extrabold text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl mb-6 text-white drop-shadow-lg
//                      text-shadow-black-lg"
//         >
//           {/* Show either Bundjalung or English greeting depending on state */}
//           {isBundjalung ? bundjalungGreeting : englishGreeting}
//         </motion.h1>
//       </AnimatePresence>

//       {/* Button component to toggle greetings */}
//       <Btn
//         label="Translate"
//         aria-label="Translate greeting between Bundjalung and English"
//         onClick={toggleGreeting}
//         whileHover={{ scale: 1.05, y: -4 }}
//         whileTap={{ scale: 0.95, y: 2 }}
//         className="text-xl sm:text-2xl md:text-3xl px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 border-white border-2 text-white rounded-full shadow-2xl transition-colors duration-300 hover:bg-green-500 tracking-tight cursor-pointer"
//       />
//     </section>
//   );
// }














// import { motion, AnimatePresence } from "framer-motion";
// import Btn from '@/components/Button/button'
// import { useState } from "react";

// export default function Section1({ bundjalungGreeting = "JINGI WALLA", englishGreeting = "WELCOME"}) {
//   const [isBundjalung, setIsBundjalung] = useState(true);
//   const toggleGreeting = () => setIsBundjalung(prev => !prev);

//   return (
//     <section
//       className="flex flex-col justify-center items-center w-full min-h-[75vh] sm:min-h-screen px-4 bg-cover bg-center mt-40"
//       style={{ backgroundImage: `url('images/Diversity.jpg')` }}
//     >
//       <AnimatePresence mode="wait">
//         <motion.h1
//           key={isBundjalung ? "bundjalung" : "english"}
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           transition={{ duration: 1 }}
//           className="text-center w-full font-extrabold text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl mb-6 text-white drop-shadow-lg
//                      text-shadow-black-lg"
//         >
//           {isBundjalung ? bundjalungGreeting : englishGreeting}
//         </motion.h1>
//       </AnimatePresence>

//       <Btn
//         label="Translate"
//         aria-label="Translate greeting between Bundjalung and English" 
//         onClick={toggleGreeting}
//         whileHover={{ scale: 1.05, y: -4 }}
//         whileTap={{ scale: 0.95, y: 2 }}
//         className="text-xl sm:text-2xl md:text-3xl px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 border-white border-2 text-white rounded-full shadow-2xl transition-colors duration-300 hover:bg-green-500 tracking-tight cursor-pointer"
        
//       />
//     </section>
//   );
// }

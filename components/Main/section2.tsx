import { motion, AnimatePresence } from "framer-motion";
import { useScrollAnimation } from "../../app/hooks/useScrollAnimation";
import Btn from "@/components/Button/button";
import { useState, ReactNode } from "react";

// ---------------------------
// 1. Define Props with Types
// ---------------------------

// Both `bundjalung` and `english` props can contain text, JSX, or React fragments.
// The best type for this flexibility is `ReactNode`.
interface Section2Props {
  bundjalung?: ReactNode;
  english?: ReactNode;
}

// ---------------------------
// 2. Functional Component
// ---------------------------

export default function Section2({
  bundjalung = (
    <>
      Ngali na jugun
      <br />
      Ngali garima mala jugun
      <br />
      Wana janjma mala gunu gala jugun
      <br />
      Ngali wana janja mala jugun
      <br />
      Ngali na mala jugun
    </>
  ),
  english = (
    <>
      We belong to this country
      <br />
      We look after this country
      <br />
      Don't do wrong around here
      <br />
      We belong to it this country
    </>
  ),
}: Section2Props) {
  // useScrollAnimation hook gives us a `ref` to attach to a DOM element
  // and a boolean `inView` to tell if the element is visible in the viewport.
  const { ref, inView } = useScrollAnimation(0.3);

  // State for tracking which language to show
  const [isBundjalung, setIsBundjalung] = useState<boolean>(true);

  // Toggle function flips language
  const toggleLanguage = (): void => setIsBundjalung((prev) => !prev);

  // ---------------------------
  // 3. Render JSX
  // ---------------------------
  return (
    <section
      ref={ref} // connect section to intersection observer for animation
      className="relative flex flex-col justify-center items-center min-h-[85vh] sm:min-h-screen px-4 sm:px-6 mt-40 bg-blue-500"
    >
      {/* Animated heading */}
      <motion.h2
        initial={{ opacity: 0, y: 50 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
        transition={{ duration: 0.6 }}
        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight text-center mb-6 text-white bg-clip-text"
      >
        Bundjalung Jugun
      </motion.h2>

      {/* AnimatePresence ensures smooth transitions between Bundjalung & English text */}
      <AnimatePresence mode="wait">
        <motion.p
          key={isBundjalung ? "bundjalung" : "english"} // ensures text fades/animates on change
          initial={{ opacity: 0, y: 50 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg sm:text-xl md:text-2xl lg:text-2xl leading-relaxed md:leading-loose tracking-wide text-white max-w-3xl whitespace-pre-line mt-6 mb-10 text-left font-bold"
          style={{ wordSpacing: "0.05em" }}
        >
          {isBundjalung ? bundjalung : english}
        </motion.p>
      </AnimatePresence>

      {/* Button to switch language */}
      <Btn
        label="Translate"
        onClick={toggleLanguage}
        whileHover={{ scale: 1.05, y: -4 }}
        whileTap={{ scale: 0.95, y: 2 }}
        className="text-xl sm:text-2xl md:text-3xl px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 border-white border-2 text-white rounded-full shadow-2xl transition-colors duration-300 hover:bg-green-500 hover:border-green-500 tracking-tight focus:outline-none cursor-pointer"
      />
    </section>
  );
}












// import { motion, AnimatePresence } from "framer-motion";
// import { useScrollAnimation } from "../../app/hooks/useScrollAnimation";
// import Btn from '@/components/Button/button'
// import { useState } from "react";

// export default function Section2({
//   bundjalung = (
//     <>
//       Ngali na jugun
//       <br />
//       Ngali garima mala jugun
//       <br />
//       Wana janjma mala gunu gala jugun
//       <br />
//       Ngali wana janja mala jugun
//       <br />
//       Ngali na mala jugun
//     </>
//   ),
//   english = (
//     <>
//       We belong to this country
//       <br />
//       We look after this country
//       <br />
//       Don't do wrong around here
//       <br />
//       We belong to it this country
//     </>
//   ),
// }) {
//   const { ref, inView } = useScrollAnimation(0.3);
//   const [isBundjalung, setIsBundjalung] = useState(true);
//   const toggleLanguage = () => setIsBundjalung(prev => !prev);

//   return (
//     <section
//       ref={ref}
//       className="relative flex flex-col justify-center items-center min-h-[85vh] sm:min-h-screen px-4 sm:px-6 mt-40 bg-blue-500"
//     >

//       <motion.h2
//         initial={{ opacity: 0, y: 50 }}
//         animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
//         transition={{ duration: 0.6 }}
//         className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight text-center mb-6 text-white bg-clip-text"
//       >
//         Bundjalung Jugun
//       </motion.h2>

//       <AnimatePresence mode="wait">
//         <motion.p
//           key={isBundjalung ? "bundjalung" : "english"}
//           initial={{ opacity: 0, y: 50 }}
//           animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
//           transition={{ duration: 0.6, delay: 0.2 }}
//           className="text-lg sm:text-xl md:text-2xl lg:text-2xl leading-relaxed md:leading-loose tracking-wide text-white max-w-3xl whitespace-pre-line mt-6 mb-10 text-left font-bold"
//           style={{ wordSpacing: "0.05em"}}
//         >
//           {isBundjalung ? bundjalung : english}
//         </motion.p>
//       </AnimatePresence>

//       <Btn 
//        label="Translate"
//        onClick={toggleLanguage}
//         whileHover={{ scale: 1.05, y: -4 }}
//         whileTap={{ scale: 0.95, y: 2 }}
//         className="text-xl sm:text-2xl md:text-3xl px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 border-white border-2 text-white rounded-full shadow-2xl transition-colors duration-300 hover:bg-green-500 hover:border-green-500 tracking-tight focus:outline-none cursor-pointer"
//       />
//     </section>
//   );
// }

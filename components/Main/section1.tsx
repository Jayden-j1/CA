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

  // Function to toggle greeting (logic unchanged)
  const toggleGreeting = () => setIsBundjalung((prev) => !prev);

  return (
    <section
      className={`
        relative
        flex flex-col justify-center items-center
        w-full min-h-[75vh] sm:min-h-screen
        px-4
        bg-cover bg-center
        mt-40
        ${className}
      `}
      // 🔒 Background image unchanged – we only improve readability ON TOP of it
      style={{ backgroundImage: `url('images/background image.png')` }}
    >
      {/* 
        🔹 Background overlay for accessibility & contrast
        -------------------------------------------------
        - Sits *behind* the text (z-index -10) but *above* the image.
        - Dark gradient improves contrast for white text across bright/busy areas.
        - Slightly adjusts darkness per breakpoint:
          • Mobile: a bit darker (smaller text needs more contrast).
          • Larger screens: still dark, but slightly softer for aesthetics.
      */}
      <div
        className="
          pointer-events-none
          absolute inset-0 -z-10
          bg-gradient-to-b
          from-black/80 via-black/60 to-black/80
          sm:from-black/70 sm:via-black/55 sm:to-black/75
          lg:from-black/60 lg:via-black/50 lg:to-black/70
        "
        aria-hidden="true"
      />

      {/* 
        Greeting text with:
        - Smooth fade-in + slight scale animation (glow-like entrance)
        - Subtle white glow + soft dark outline for readability
        - Works for both Bundjalung and English states
      */}
      <AnimatePresence mode="wait">
        <motion.h1
          key={isBundjalung ? "bundjalung" : "english"}
          // ✅ Smooth text fade-in "glow" animation:
          // - Starts slightly smaller + faint (scale 0.94, opacity 0)
          // - Grows to full size/opacity with easeOut → feels soft and calm
          initial={{ opacity: 0, scale: 0.94, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -4 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="
            text-center w-full font-extrabold
            text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl
            mb-6 text-white
            drop-shadow-lg
          "
          // ✅ Subtle glow + outline, tuned for readability:
          // - White inner glow: helps the letters stand out.
          // - Slight outer white glow: soft halo effect.
          // - Dark shadows around the letters: acts like a gentle outline
          //   so the text is still readable over bright or busy parts.
          // - This combination, plus the dark overlay, significantly improves
          //   contrast (accessibility) while keeping it visually modern.
          style={{
            textShadow: `
              0 0 10px rgba(255,255,255,0.55),   /* inner soft white glow */
              0 0 22px rgba(255,255,255,0.40),   /* outer white halo */
              2px 2px 5px rgba(0,0,0,0.70),      /* lower-right dark outline */
              -2px -2px 5px rgba(0,0,0,0.55)     /* upper-left dark outline */
            `,
          }}
        >
          {isBundjalung ? bundjalungGreeting : englishGreeting}
        </motion.h1>
      </AnimatePresence>

      {/* Translate button (logic & styles unchanged) */}
      <Btn
        label="Translate"
        aria-label="Translate greeting between Bundjalung and English"
        onClick={toggleGreeting}
        whileHover={{ scale: 1.05, y: -4 }}
        whileTap={{ scale: 0.95, y: 2 }}
        className="
          text-xl sm:text-2xl md:text-3xl
          px-6 sm:px-8 py-3 sm:py-4
          bg-blue-600 border-white border-2 text-white rounded-full
          shadow-2xl transition-colors duration-300
          hover:bg-green-500 tracking-tight cursor-pointer
        "
      />
    </section>
  );
}









// import { motion, AnimatePresence } from "framer-motion";
// import Btn from "@/components/Button/button";
// import { useState } from "react";

// // Define the props interface for Section1
// interface Section1Props {
//   bundjalungGreeting?: string; // Optional Bundjalung greeting
//   englishGreeting?: string;    // Optional English greeting
//   className?: string;          // Optional CSS class for custom styling
// }

// export default function Section1({
//   bundjalungGreeting = "JINGI WALLA",
//   englishGreeting = "WELCOME",
//   className = "",
// }: Section1Props) {
//   // State to toggle between Bundjalung and English greeting
//   const [isBundjalung, setIsBundjalung] = useState(true);

//   // Function to toggle greeting
//   const toggleGreeting = () => setIsBundjalung((prev) => !prev);

//   return (
//     <section
//       className={`flex flex-col justify-center items-center w-full min-h-[75vh] sm:min-h-screen px-4 bg-cover bg-center mt-40 ${className}`}
//       style={{ backgroundImage: `url('images/background image.png')` }}
//     >
//       {/* Animate greeting with fade in/out */}
//       <AnimatePresence mode="wait">
//         <motion.h1
//           key={isBundjalung ? "bundjalung" : "english"}
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           transition={{ duration: 1 }}
//           className="text-center w-full font-extrabold text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl mb-6 text-white drop-shadow-lg text-shadow-black-lg"
//         >
//           {isBundjalung ? bundjalungGreeting : englishGreeting}
//         </motion.h1>
//       </AnimatePresence>

//       {/* Translate button */}
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












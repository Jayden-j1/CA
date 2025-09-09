import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function Section1({ bundjalungGreeting = "JINGI WALLA", englishGreeting = "WELCOME" }) {
  const [isBundjalung, setIsBundjalung] = useState(true);
  const toggleGreeting = () => setIsBundjalung(prev => !prev);

  return (
    <section
      className="flex flex-col justify-center items-center w-full min-h-[75vh] sm:min-h-screen px-4 mb-6 sm:mb-10 bg-cover bg-center"
      style={{ backgroundImage: `url('images/Diversity.jpg')` }}
    >
      <AnimatePresence mode="wait">
        <motion.h1
          key={isBundjalung ? "bundjalung" : "english"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 5 }}
          className="text-center w-full font-extrabold text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl mb-6 text-white drop-shadow-lg"
        >
          {isBundjalung ? bundjalungGreeting : englishGreeting}
        </motion.h1>
      </AnimatePresence>

      <motion.button
        aria-label="Translate greeting between Bundjalung and English"
        onClick={toggleGreeting}
        whileHover={{ scale: 1.05, y: -4 }}
        whileTap={{ scale: 0.95, y: 2 }}
        className="text-xl sm:text-2xl md:text-3xl px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 text-white rounded-full shadow-2xl transition-colors duration-300 hover:bg-blue-700 tracking-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Translate
      </motion.button>
    </section>
  );
}

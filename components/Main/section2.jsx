import { motion, AnimatePresence } from "framer-motion";
import { useScrollAnimation } from "../../app/hooks/useScrollAnimation";
import Btn from '@/components/Button/button'
import { useState } from "react";

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
}) {
  const { ref, inView } = useScrollAnimation(0.3);
  const [isBundjalung, setIsBundjalung] = useState(true);
  const toggleLanguage = () => setIsBundjalung(prev => !prev);

  return (
    <section
      ref={ref}
      className="flex flex-col justify-center items-center min-h-[85vh] sm:min-h-screen bg-white px-4 sm:px-6"
    >
      <motion.h2
        initial={{ opacity: 0, y: 50 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
        transition={{ duration: 0.6 }}
        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-center"
      >
        Bundjalung Jugun
      </motion.h2>

      <AnimatePresence mode="wait">
        <motion.p
          key={isBundjalung ? "bundjalung" : "english"}
          initial={{ opacity: 0, y: 50 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-base sm:text-lg md:text-xl lg:text-2xl leading-relaxed tracking-normal text-gray-700 max-w-2xl whitespace-pre-line mt-6 mb-10 text-left"
          style={{ wordSpacing: "0.05em"}}
        >
          {isBundjalung ? bundjalung : english}
        </motion.p>
      </AnimatePresence>

      <Btn 
       label="Translate"
       onClick={toggleLanguage}
        whileHover={{ scale: 1.05, y: -4 }}
        whileTap={{ scale: 0.95, y: 2 }}
        className="text-xl sm:text-2xl md:text-3xl px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 text-white rounded-full shadow-2xl transition-colors duration-300 hover:bg-blue-700 tracking-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* <motion.button
        aria-label="Translate language between Bundjalung and English"
        onClick={toggleLanguage}
        whileHover={{ scale: 1.05, y: -4 }}
        whileTap={{ scale: 0.95, y: 2 }}
        className="text-xl sm:text-2xl md:text-3xl px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 text-white rounded-full shadow-2xl transition-colors duration-300 hover:bg-blue-700 tracking-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Translate
      </motion.button> */}
    </section>
  );
}

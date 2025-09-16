'use client';
import Image from "next/image";
import { motion, useAnimationControls } from "framer-motion";
import { useEffect } from "react";

export default function TopofPageContent({ HeadingOneTitle, paragraphContent, linkOne }) {
  const controls = useAnimationControls();

  useEffect(() => {
    let isMounted = true;

    const cycleColors = async () => {
      while (isMounted) {
        await controls.start({
          background: "linear-gradient(to bottom, #1e3a8a, #60a5fa)", // deep blue to light blue
          transition: { duration: 1.8 },
        });
        await controls.start({
          background: "linear-gradient(to bottom, #0f766e, #5eead4)", // teal to turquoise
          transition: { duration: 1.8 },
        });
        await controls.start({
          background: "linear-gradient(to bottom, #0284c7, #67e8f9)", // sky blue to cyan
          transition: { duration: 1.8 },
        });
      }
    };

    // Delay the animation start to the next tick
    const timeout = setTimeout(() => {
      cycleColors();
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timeout); // cleanup if unmounted before timeout
    };
  }, [controls]);

  return (
    <>
      <section className="relative w-full py-16 md:py-24 overflow-hidden">

        {/* Blue background */}
        <div className="absolute inset-0 bg-blue-500 shadow-xl shadow-blue-800/30 -skew-y-6 z-10 rounded-b-[60px]" />

        {/* Main content */}
        <div className="relative z-30 flex flex-col md:flex-row items-center justify-between gap-8 px-6 md:px-12 text-white max-w-7xl mx-auto">

          {/* Left Text Block */}
          <div className="w-full md:w-3/5">
            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 md:mb-12 text-left">
              {HeadingOneTitle}
            </h1>
            <p className="text-sm sm:text-base md:text-lg font-medium leading-relaxed mb-10">
              {paragraphContent}
            </p>
            <a
              href="#pricing"
              className="px-6 py-3 bg-green-500 text-white font-semibold rounded-full hover:bg-green-400 transition-colors duration-300"
            >
              {linkOne}
            </a>
          </div>

          {/* Right Content Block */}
          <div className="hidden md:block md:w-2/5 p-4 rounded-lg shadow-md relative h-52 overflow-hidden">

            {/* Background Image */}
            <Image
              src="/images/country.jpeg"
              alt="Image of an Aboriginal Australian dot painting, primary colour used is blue."
              fill
              className="absolute object-cover rounded-lg"
            />

            {/* Animated Gradient Overlay (Framer Motion) */}
            <motion.div
              className="absolute inset-0 z-10 rounded-lg opacity-60"
              animate={controls}
            />
          </div>
        </div>
      </section>
    </>
  );
}





// 'use client';
// import Image from "next/image";
// import { motion, useAnimationControls } from "framer-motion";
// import { useEffect } from "react";

// export default function TopofPageContent({ HeadingOneTitle, paragraphContent, linkOne }) {
//   const controls = useAnimationControls();

//   useEffect(() => {
//     const cycleColors = async () => {
//       while (true) {
//         await controls.start({
//           background: "linear-gradient(to bottom, #1e3a8a, #60a5fa)", // deep blue to light blue
//           transition: { duration: 1.8 },
//         });
//         await controls.start({
//           background: "linear-gradient(to bottom, #0f766e, #5eead4)", // teal to turquoise
//           transition: { duration: 1.8 },
//         });
//         await controls.start({
//           background: "linear-gradient(to bottom, #0284c7, #67e8f9)", // sky blue to cyan
//           transition: { duration: 1.8 },
//         });
//       }
//     };

//     cycleColors();
//   }, [controls]);

//   return (
//     <>
//       <section className="relative w-full py-16 md:py-24 overflow-hidden">

//         {/* Blue background */}
//         <div className="absolute inset-0 bg-blue-500 shadow-xl shadow-blue-800/30 -skew-y-6 z-10 rounded-b-[60px]" />

//         {/* Main content */}
//         <div className="relative z-30 flex flex-col md:flex-row items-center justify-between gap-8 px-6 md:px-12 text-white max-w-7xl mx-auto">

//           {/* Left Text Block */}
//           <div className="w-full md:w-3/5">
//             <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 md:mb-12 text-left">
//               {HeadingOneTitle}
//             </h1>
//             <p className="text-sm sm:text-base md:text-lg font-medium leading-relaxed mb-10">
//               {paragraphContent}
//             </p>
//             <a
//               href="#pricing"
//               className="px-6 py-3 bg-green-500 text-white font-semibold rounded-full hover:bg-green-400 transition-colors duration-300"
//             >
//               {linkOne}
//             </a>
//           </div>

//           {/* Right Content Block */}
//           <div className="hidden md:block md:w-2/5 p-4 rounded-lg shadow-md relative h-52 overflow-hidden">

//             {/* Background Image */}
//             <Image
//               src="/images/country.jpeg"
//               alt="Image of an Aboriginal Australian dot painting, primary colour used is blue."
//               fill
//               className="absolute object-cover rounded-lg"
//             />

//             {/* Animated Gradient Overlay (Framer Motion) */}
//             <motion.div
//               className="absolute inset-0 z-10 rounded-lg opacity-60"
//               animate={controls}
//             />
//           </div>
//         </div>
//       </section>
//     </>
//   );
// }

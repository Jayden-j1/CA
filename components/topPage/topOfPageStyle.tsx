'use client';

import Image from 'next/image';
import { motion, useAnimationControls } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface TopOfPageContentProps {
  HeadingOneTitle: string;
  paragraphContent: string;
  linkOne: string;
  href?: string; // optional link
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void; // optional handler
}

/**
 * Why this implementation fixes the error:
 * ----------------------------------------
 * - The animated overlay lives inside a container that is `hidden` on small screens
 *   (`hidden md:block`). When it's hidden, the <motion.div> is NOT mounted.
 * - Calling `controls.start(...)` while the element isn't mounted causes Framer
 *   Motion to throw: "controls.start() should only be called after a component
 *   has mounted."
 * - Solution: Detect when we are at least `md` (>= 768px) via matchMedia.
 *   Only start the loop when the element is present. Stop it when leaving `md`.
 */
export default function TopofPageContent({
  HeadingOneTitle,
  paragraphContent,
  linkOne,
  href = '#',
  onClick,
}: TopOfPageContentProps) {
  const controls = useAnimationControls();

  // Tracks if the animated element is on the page (md and up).
  const [isMdUp, setIsMdUp] = useState<boolean>(false);

  // A ref to cancel the loop when unmounting or when `isMdUp` flips to false.
  const cancelRef = useRef<boolean>(false);

  // --------------------------------------------
  // Breakpoint detector: md (>= 768px)
  // --------------------------------------------
  useEffect(() => {
    // Guard: window is client-only
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia('(min-width: 768px)');

    const update = () => setIsMdUp(mql.matches);
    update(); // set initial state

    // Modern browsers: addEventListener; older: addListener fallback
    if (mql.addEventListener) {
      mql.addEventListener('change', update);
    } else {
      
      mql.addListener(update);
    }

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', update);
      } else {
        
        mql.removeListener(update);
      }
    };
  }, []);

  // --------------------------------------------
  // Gradient animation loop (only when md+)
  // --------------------------------------------
  useEffect(() => {
    cancelRef.current = false;

    // If the element isn't mounted (hidden under md), do nothing.
    if (!isMdUp) {
      // Stop any in-flight animation cleanly (no-ops if none)
      controls.stop();
      return;
    }

    // Run an async loop that gracefully exits on cleanup.
    const run = async () => {
      // Small delay ensures the motion element has mounted.
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      while (!cancelRef.current) {
        // Each step awaits completion and checks cancellation between steps.
        await controls.start({
          background: 'linear-gradient(to bottom, #1e3a8a, #60a5fa)',
          transition: { duration: 1.8 },
        });
        if (cancelRef.current) break;

        await controls.start({
          background: 'linear-gradient(to bottom, #0f766e, #5eead4)',
          transition: { duration: 1.8 },
        });
        if (cancelRef.current) break;

        await controls.start({
          background: 'linear-gradient(to bottom, #0284c7, #67e8f9)',
          transition: { duration: 1.8 },
        });
      }
    };

    run();

    return () => {
      // Signal cancellation and stop the controller to avoid stray warnings.
      cancelRef.current = true;
      controls.stop();
    };
  }, [controls, isMdUp]);

  return (
    <section className="relative w-full py-16 md:py-24 overflow-hidden">
      {/* Static background */}
      <div className="absolute inset-0 bg-blue-500 shadow-xl shadow-blue-800/30 -skew-y-6 z-10 rounded-b-[60px]" />

      {/* Main content */}
      <div className="relative z-30 flex flex-col md:flex-row items-center justify-between gap-8 px-6 md:px-12 text-white max-w-7xl mx-auto">
        <div className="w-full md:w-3/5">
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 md:mb-12 text-left">
            {HeadingOneTitle}
          </h1>
          <p className="text-sm sm:text-base md:text-lg font-medium leading-relaxed mb-10">
            {paragraphContent}
          </p>

          {/* Call to Action */}
          <a
            href={href}
            onClick={onClick}
            className="px-6 py-3 bg-green-500 text-white font-semibold rounded-full hover:bg-green-400 transition-colors duration-300 inline-block"
          >
            {linkOne}
          </a>
        </div>

        {/* Right-side image with animated gradient overlay */}
        {/* NOTE: This block is hidden under md; animation only runs when md+ */}
        <div className="hidden md:block md:w-2/5 p-4 rounded-lg shadow-md relative h-52 overflow-hidden">
          <Image
            src="/images/country.jpeg"
            alt="Aboriginal dot painting with blue colors"
            fill
            className="absolute object-cover rounded-lg"
            priority
          />
          <motion.div
            className="absolute inset-0 z-10 rounded-lg opacity-60"
            // The controller only starts when md+ to avoid the warning.
            animate={controls}
          />
        </div>
      </div>
    </section>
  );
}

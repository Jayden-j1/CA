// app/dashboard/cultural-resources/page.tsx
//
// Purpose:
// - Dedicated "Cultural Resources" page inside the dashboard.
// - Provides simple, structured information about cultural awareness topics
//   using an animated hero panel + image + expandable sections.
// - Follows the same visual language as your existing dashboard content:
//   • blue gradient / solid blues
//   • rounded cards
//   • shadowed panels
//   • responsive grid layout
//
// Notes:
// - This is a client component because it uses React state + framer-motion
//   for animation and interactivity.
// - Navigation to this page is already wired via a Next.js <Link /> from the dashboard.

"use client";

import React, { useEffect, useState } from "react"; // ✅ Added useEffect for auto-rotation
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

// -----------------------------
// 1. Type definitions
// -----------------------------

// Each section of the cultural resources accordion uses this shape.
interface Section {
  title: string;
  content: string;
}

// -----------------------------
// 2. Static content configuration
// -----------------------------

// Words used in the animated hero heading; they cycle to keep attention
// without overwhelming the user.
const rotatingWords: string[] = [
  "Cultural Resources",
  "Listening to Country",
  "Respecting First Nations Knowledge",
];

// High-level cultural resource sections. You can add more later by simply
// extending this array.
const sections: Section[] = [
  {
    title: "Understanding History",
    content:
      "Learn about the deep and diverse histories of First Nations peoples, including the impact of colonisation, ongoing resistance, and the importance of truth-telling in reconciliation.",
  },
  {
    title: "Building Relationships",
    content:
      "Effective collaboration with local Aboriginal communities starts with listening, respect, and long-term relationship-building based on trust, consent, and accountability.",
  },
  {
    title: "Cultural Strengths",
    content:
      "First Nations communities bring unique perspectives, knowledge systems, and strengths that enrich all aspects of society, from land management to governance and education.",
  },
  {
    title: "Protocols & Respect",
    content:
      "Understanding cultural protocols—such as Acknowledgement of Country, Welcome to Country, and the role of Elders—is essential to showing genuine respect and avoiding tokenism.",
  },
];

// -----------------------------
// 3. Page component
// -----------------------------

export default function CulturalResourcesPage() {
  // Track which rotating word is currently displayed in the hero heading.
  const [wordIndex, setWordIndex] = useState(0);

  // Track which accordion section is currently open.
  // - null means all sections are collapsed.
  // - an index (0, 1, 2, ...) means that section is expanded.
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  // -----------------------------------------
  // Auto-rotation for the hero heading words
  // -----------------------------------------
  //
  // Instead of requiring a user click, we set up a small interval that
  // automatically advances the `wordIndex` every few seconds.
  //
  // Why:
  // - Keeps the hero visually engaging without extra interaction.
  // - Keeps logic simple and robust: one interval + cleanup.
  // - Modulo (%) ensures we loop cleanly through the words.
  useEffect(() => {
    // Change word every 6 seconds (6000ms).
    const intervalId = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % rotatingWords.length);
    }, 6000);

    // Cleanup: clear the interval when the component unmounts to avoid
    // memory leaks or updates on an unmounted component.
    return () => clearInterval(intervalId);
  }, []);

  // Toggle a given section in the accordion.
  // - If the section is already open, close it (set to null).
  // - Otherwise, open that section and close any others.
  const toggleSection = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <main
      className="
        min-h-screen
        bg-linear-to-br from-slate-900 via-blue-950 to-blue-900
        flex
        items-center
        justify-center
        px-4
        py-8
        sm:px-6
        lg:px-10
      "
    >
      {/* 
        Outer container:
        - Constrains the width for readability.
        - Uses the same white/blue card-on-gradient pattern as your other dashboard pages.
      */}
      <div className="w-full max-w-6xl bg-white/90 rounded-2xl shadow-2xl p-6 sm:p-8 lg:p-10">
        {/* Page heading and brief introduction */}
        <header className="mb-8">
          {/* Main heading for the page (semantic <h1> for accessibility) */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-900 tracking-tight mb-2">
            Cultural Resources
          </h1>
          {/* Supporting text to explain the purpose of this page */}
          <p className="text-sm sm:text-base text-gray-700 max-w-3xl">
            Explore practical, strengths-based cultural awareness resources that
            support respectful relationships with Aboriginal and Torres Strait
            Islander communities. Use these sections as a starting point for
            ongoing learning rather than a one-time checklist.
          </p>
        </header>

        {/* 
          Main layout:
          - On small screens: stacked vertically using flex-col.
          - On extra-large screens: a 5-column grid similar to your existing layout:
              • 3 columns for the hero text card
              • 2 columns for the image
              • Full width row for the accordion sections
        */}
        <div className="flex flex-col xl:grid xl:grid-cols-5 gap-7">
          {/* 
            Hero card (left on large screens)
            - Blue background with animated heading text (framer-motion).
            - Words now rotate automatically; no click needed.
          */}
          <section
            className="
              col-span-1 md:col-span-3 row-span-1 md:row-span-2
              border-2 border-gray-300
              p-6
              rounded-lg
              shadow-xl
              bg-blue-500
            "
            aria-label="Cultural resources introduction card"
          >
            {/* Animated heading area */}
            <div className="h-auto sm:h-14 relative overflow-hidden mb-6 min-h-[3rem]">
              <AnimatePresence mode="wait">
                <motion.h2
                  key={rotatingWords[wordIndex]}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="
                    absolute
                    text-2xl sm:text-4xl md:text-5xl
                    font-bold
                    text-white
                    tracking-widest sm:tracking-wide
                    whitespace-nowrap sm:whitespace-normal
                    break-words
                    w-full
                  "
                >
                  {rotatingWords[wordIndex]}
                </motion.h2>
              </AnimatePresence>
            </div>

            {/* Short "We aim to" list, mirroring your existing language */}
            <p className="text-lg sm:text-xl leading-relaxed tracking-normal sm:tracking-wide text-white font-semibold mb-5">
              <span className="italic px-2 py-1 bg-green-500 rounded-3xl">
                We aim to:
              </span>
            </p>
            <ul className="list-disc pl-4 space-y-2">
              <li className="text-white">
                Support non-Indigenous people and organisations in learning
                about Indigenous history, cultures, and connection to Country.
              </li>
              <li className="text-white">
                Promote open-mindedness, active listening, and collaboration.
              </li>
              <li className="text-white">
                Foster respectful, stronger relationships with local communities.
              </li>
              <li className="text-white">
                Acknowledge and celebrate Indigenous strengths, knowledge, and
                resilience.
              </li>
            </ul>
          </section>

          {/* 
            Image panel (right on large screens)
            - Uses next/image for performance and automatic optimisation.
            - Aspect ratio is preserved for a consistent, responsive layout.
          */}
          <section
            className="
              aspect-video
              col-span-1 md:col-span-2 row-span-1 md:row-span-2
              border-2 border-gray-300
              p-4
              rounded-lg
              bg-gray-50
              relative
              shadow-2xl
            "
            aria-label="Cultural imagery"
          >
            {/* 
              next/image with `fill`:
              - `fill` + `absolute` + `object-cover` ensures the image fills
                the container while preserving aspect ratio.
              - Make sure `/public/images/Cabbage_Tree_Island.jpg` exists.
            */}
            <Image
              src="/images/Cabbage_Tree_Island.jpg"
              alt="Cabbage Tree Island on Bundjalung Country"
              fill
              className="object-cover rounded-md absolute"
              sizes="(min-width: 1280px) 40vw, 100vw"
            />
          </section>

          {/* 
            Accordion sections:
            - Full-width row below the hero + image.
            - Each section can be expanded or collapsed.
            - Only one section is open at a time for simplicity.
            - We use buttons for accessibility and proper keyboard support.
          */}
          <section className="col-span-1 md:col-span-5 row-span-1 space-y-4 mt-2">
            {sections.map((section, index) => {
              const isOpen = openIndex === index;
              const contentId = `cultural-section-content-${index}`;
              const buttonId = `cultural-section-button-${index}`;

              return (
                <div
                  key={section.title}
                  className="
                    bg-blue-500
                    shadow-2xl
                    rounded-md
                    hover:bg-blue-400
                    hover:shadow
                    transition-all
                    duration-200
                  "
                >
                  {/* 
                    Accessible disclosure button:
                    - role: default button role
                    - aria-expanded: tells screen readers if content is visible
                    - aria-controls: links button to content container by ID
                  */}
                  <button
                    id={buttonId}
                    onClick={() => toggleSection(index)}
                    className="
                      w-full
                      flex
                      justify-between
                      items-center
                      p-4
                      text-left
                      cursor-pointer
                      focus:outline-none
                      focus-visible:ring
                      focus-visible:ring-offset-2
                      focus-visible:ring-offset-blue-500
                      focus-visible:ring-white
                    "
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                    type="button"
                  >
                    <span className="font-medium text-lg text-white tracking-wide">
                      {section.title}
                    </span>
                    <ChevronDownIcon
                      className={`
                        w-5 h-5
                        text-white
                        transform
                        transition-transform
                        duration-300
                        ${isOpen ? "rotate-180 text-blue-100" : ""}
                      `}
                      aria-hidden="true"
                    />
                  </button>

                  {/* 
                    Animated content area:
                    - AnimatePresence lets us animate exit as well as enter.
                    - We use height: 0 -> auto and opacity for a smooth slide.
                  */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key={contentId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        id={contentId}
                        aria-labelledby={buttonId}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 text-white text-base tracking-wide leading-relaxed">
                          {section.content}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </main>
  );
}

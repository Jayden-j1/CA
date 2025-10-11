// components/lesson/PortableTextRenderer.tsx
//
// Purpose
// -------
// Render rich lesson content (text, images, callouts, slider, quiz, embeds, Mux video) from Sanity
// using @portabletext/react and your own interactive components.
//
// Key fixes in this version
// -------------------------
// - Corrected import path for LessonInteractive (kept under `components/lesson/`).
// - Removed the invalid `controls` prop from MuxPlayer (controls are ON by default).
// - Defensive checks around Sanity assets so unknown shapes fail gracefully.
//
// Pillars
// -------
// - Simplicity: declarative component map.
// - Robustness: guards for missing fields; no unsafe assumptions.
// - Accessibility: images include alt; iframes allowFullScreen.
// - Security: no external eval; embeds are via iframes with controlled sources.

"use client";

import Image from "next/image";
import { PortableText, type PortableTextComponents } from "@portabletext/react";

// ✅ Correct path: we keep lesson components under `components/lesson/`
import LessonInteractive from "@/app/dashboard/course/components/lesson/LessonInteractive";

// Optional: only import MuxPlayer if you’re using the Mux field.
// Remove this import if you’re not using Mux.
import MuxPlayer from "@mux/mux-player-react";

type AnyRecord = Record<string, any>;

const components: PortableTextComponents = {
  // Custom Sanity block/object types → React components
  types: {
    // Inline/stored images
    image: ({ value }) => {
      const url: string | undefined = value?.asset?.url;
      const alt: string = value?.alt || "Lesson image";
      if (!url) return null; // Guard: some setups store only the asset ref
      return (
        <div className="my-6">
          <Image
            src={url}
            alt={alt}
            width={800}
            height={450}
            className="rounded-lg shadow-sm mx-auto"
          />
        </div>
      );
    },

    // Highlighted callout (tone: info|warning|success)
    callout: ({ value }) => {
      const toneClass =
        value?.tone === "warning"
          ? "bg-amber-100 border-amber-400"
          : value?.tone === "success"
          ? "bg-emerald-100 border-emerald-400"
          : "bg-blue-100 border-blue-400";
      return (
        <div className={`border-l-4 ${toneClass} p-4 my-4 rounded-r-lg text-gray-800`}>
          {value?.text}
        </div>
      );
    },

    // Interactive quiz and slider map to your reusable component
    quiz: ({ value }) => <LessonInteractive type="quiz" data={value} />,
    slider: ({ value }) => <LessonInteractive type="slider" data={value} />,

    // Embedded media (YouTube, Vimeo, Canva, etc.)
    embed: ({ value }) => {
      const url: string | undefined = value?.url;
      if (!url) return null;
      return (
        <div className="my-6 aspect-video">
          <iframe
            src={url}
            title={value?.title || "Embedded media"}
            className="w-full h-full rounded-lg"
            allowFullScreen
          />
        </div>
      );
    },

    // Mux streaming video (if present in your schema/content)
    // NOTE: MuxPlayer shows controls by default; do NOT pass a `controls` prop here.
    muxVideo: ({ value }) => {
      const playbackId = value?.asset?.playbackId;
      if (!playbackId) return null;
      return (
        <div className="my-6">
          <MuxPlayer
            playbackId={playbackId}
            streamType="on-demand"
            className="w-full aspect-video rounded-lg shadow"
          />
        </div>
      );
    },
  },

  // Headings and paragraph styles for normal text blocks
  block: {
    h2: ({ children }) => (
      <h2 className="text-2xl font-bold text-blue-900 mt-8 mb-3">{children}</h2>
    ),
    normal: ({ children }) => (
      <p className="text-gray-800 leading-relaxed mb-4">{children}</p>
    ),
  },
};

export default function PortableTextRenderer({ value }: { value: AnyRecord }) {
  return (
    <article className="prose prose-blue max-w-none">
      <PortableText value={value} components={components} />
    </article>
  );
}

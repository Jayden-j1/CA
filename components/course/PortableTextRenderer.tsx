// components/course/PortableTextRenderer.tsx
//
// Purpose
// -------
// Render Sanity Portable Text (blocks[]) with:
//  • headings, paragraphs, and lists
//  • inline IMAGES (using @sanity/image-url → urlFor())
//  • inline VIDEO EMBEDS (custom "videoEmbed" object) via <VideoPlayer />
//
// Usage
// -----
// <PortableTextRenderer value={blocksArray} className="prose prose-blue max-w-none" />
//
// Design pillars
// --------------
// • Efficiency: pure functional, minimal state.
// • Robustness: guards for unknown nodes; alt-safe images.
// • Simplicity: all PT config lives here; page stays clean.
// • Security: no dangerous HTML; uses React + sanitized URLs.

"use client";

import * as React from "react";
import { PortableText, PortableTextComponents } from "@portabletext/react";
import type { TypedObject } from "@portabletext/types";

import { urlFor } from "@/lib/sanity/client";
import VideoPlayer from "@/components/course/VideoPlayer";

type Props = {
  value: TypedObject[];              // Portable Text blocks from Sanity
  className?: string;                // optional wrapper classes (e.g., prose)
};

const components: PortableTextComponents = {
  block: {
    h2: ({ children }) => (
      <h2 className="text-2xl font-bold text-blue-900 mt-6 mb-3">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-xl font-semibold text-blue-800 mt-5 mb-2">{children}</h3>
    ),
    normal: ({ children }) => (
      <p className="text-gray-800 leading-relaxed mb-3">{children}</p>
    ),
  },

  list: {
    bullet: ({ children }) => (
      <ul className="list-disc ml-6 text-gray-800 space-y-1">{children}</ul>
    ),
    number: ({ children }) => (
      <ol className="list-decimal ml-6 text-gray-800 space-y-1">{children}</ol>
    ),
  },

  marks: {
    // Add more if you need (link mark, etc.)
  },

  // Custom types inside PT arrays
  types: {
    // Sanity image block: { _type: 'image', asset: { _ref } }
    image: ({ value }) => {
      if (!value?.asset?._ref) return null;

      const src = urlFor(value).width(1400).fit("max").url();
      const alt =
        typeof value?.alt === "string" && value.alt.trim().length > 0
          ? value.alt
          : "Lesson image";

      return (
        <figure className="my-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="rounded-lg border border-gray-200 shadow-sm w-full"
            loading="lazy"
            decoding="async"
          />
          {value?.caption && (
            <figcaption className="text-sm text-gray-600 mt-2">{value.caption}</figcaption>
          )}
        </figure>
      );
    },

    // Custom inline video object: { _type: 'videoEmbed', url, caption? }
    videoEmbed: ({ value }) => {
      const url = typeof value?.url === "string" ? value.url : "";
      if (!url) return null;

      return (
        <div className="my-6">
          <VideoPlayer src={url} title={value?.caption || "Embedded video"} />
          {value?.caption && (
            <p className="text-sm text-gray-600 mt-2">{value.caption}</p>
          )}
        </div>
      );
    },
  },
};

export default function PortableTextRenderer({ value, className }: Props) {
  // Defensive: if someone passes a string or null accidentally
  if (!Array.isArray(value)) return null;
  return <div className={className}><PortableText value={value} components={components} /></div>;
}

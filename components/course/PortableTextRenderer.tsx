// components/course/PortableTextRenderer.tsx
//
// Purpose
// -------
// Render Sanity Portable Text (blocks[]) with:
//  • headings, paragraphs, and lists
//  • inline IMAGES (using @sanity/image-url → urlFor())
//  • inline VIDEO EMBEDS (custom "videoEmbed" object) via <VideoPlayer />
//  • CODE blocks (with <pre><code> styling)
//  • CALLOUT objects (note/tip/warning panels)
//
// Usage
// -----
// <PortableTextRenderer value={blocksArray} className="prose prose-blue max-w-none" />
//
// Design pillars
// --------------
// • Efficiency: pure functional, no state.
// • Robustness: guards for unknown nodes; alt-safe images; safe links.
// • Simplicity: all PT config lives here; page stays clean.
// • Security: no dangerouslySetInnerHTML; all rendering via React.

"use client";

import * as React from "react";
import { PortableText, PortableTextComponents } from "@portabletext/react";
import type { TypedObject } from "@portabletext/types";

import { urlFor } from "@/lib/sanity/client";
import VideoPlayer from "@/components/course/VideoPlayer";

type Props = {
  value: TypedObject[]; // Portable Text blocks from Sanity
  className?: string;   // optional wrapper classes (e.g., "prose max-w-none")
};

const components: PortableTextComponents = {
  // Headings and paragraphs
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
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-blue-300 pl-4 italic text-gray-700 my-4">
        {children}
      </blockquote>
    ),
  },

  // Lists
  list: {
    bullet: ({ children }) => (
      <ul className="list-disc ml-6 text-gray-800 space-y-1">{children}</ul>
    ),
    number: ({ children }) => (
      <ol className="list-decimal ml-6 text-gray-800 space-y-1">{children}</ol>
    ),
  },

  // Inline marks (strong/em/link/code etc.)
  marks: {
    link: ({ children, value }) => {
      const href = typeof value?.href === "string" ? value.href : "#";
      const isExternal = href?.startsWith("http");
      return (
        <a
          href={href}
          rel={isExternal ? "noopener noreferrer" : undefined}
          target={isExternal ? "_blank" : undefined}
          className="text-blue-600 underline underline-offset-2 hover:text-blue-800"
        >
          {children}
        </a>
      );
    },
    code: ({ children }) => (
      <code className="rounded bg-gray-100 px-1 py-0.5 text-sm">{children}</code>
    ),
  },

  // Custom block/object types inside PT arrays
  types: {
    // Sanity image block: { _type: 'image', asset: { _ref }, alt?, caption? }
    image: ({ value }) => {
      if (!value?.asset?._ref) return null;

      // Build URL; keep it responsive and optimized.
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

    // Built-in Sanity code block: { _type: 'code', language?, code }
    code: ({ value }) => {
      const code = typeof value?.code === "string" ? value.code : "";
      const language = typeof value?.language === "string" ? value.language : "text";
      if (!code) return null;

      return (
        <pre className="my-4 rounded-lg bg-gray-900 text-gray-100 p-4 overflow-x-auto text-sm">
          <div className="mb-2 text-xs text-gray-400 uppercase tracking-wide">{language}</div>
          <code>{code}</code>
        </pre>
      );
    },

    // Lightweight callout object (note/tip/warning)
    callout: ({ value }) => {
      const tone = (value?.tone as string) || "note";
      const title = (value?.title as string) || undefined;
      const body = (value?.body as string) || "";

      const toneClass =
        tone === "warning"
          ? "bg-yellow-50 border-yellow-300 text-yellow-900"
          : tone === "tip"
          ? "bg-emerald-50 border-emerald-300 text-emerald-900"
          : "bg-blue-50 border-blue-300 text-blue-900"; // note

      return (
        <div className={`my-4 border rounded-xl p-4 ${toneClass}`}>
          {title && <div className="font-semibold mb-1">{title}</div>}
          <p className="text-sm leading-relaxed">{body}</p>
        </div>
      );
    },
  },
};

export default function PortableTextRenderer({ value, className }: Props) {
  // Defensive: if someone passes a string or null accidentally
  if (!Array.isArray(value)) return null;
  return (
    <div className={className}>
      <PortableText value={value} components={components} />
    </div>
  );
}

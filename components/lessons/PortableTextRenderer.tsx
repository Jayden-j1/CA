"use client";

import Image from "next/image";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import LessonInteractive from "./LessonInteractive";
import MuxPlayer from "@mux/mux-player-react";

const components: PortableTextComponents = {
  types: {
    image: ({ value }) =>
      value?.asset ? (
        <div className="my-6">
          <Image
            src={value.asset.url}
            alt={value.alt || "Lesson image"}
            width={800}
            height={450}
            className="rounded-lg shadow-sm mx-auto"
          />
        </div>
      ) : null,

    callout: ({ value }) => {
      const tone =
        value.tone === "warning"
          ? "bg-amber-100 border-amber-400"
          : value.tone === "success"
          ? "bg-emerald-100 border-emerald-400"
          : "bg-blue-100 border-blue-400";
      return (
        <div className={`border-l-4 ${tone} p-4 my-4 rounded-r-lg text-gray-800`}>
          {value.text}
        </div>
      );
    },

    quiz: ({ value }) => <LessonInteractive type="quiz" data={value} />,
    slider: ({ value }) => <LessonInteractive type="slider" data={value} />,

    embed: ({ value }) =>
      value?.url ? (
        <div className="my-6 aspect-video">
          <iframe
            src={value.url}
            title={value.title || "Embedded video"}
            className="w-full h-full rounded-lg"
            allowFullScreen
          />
        </div>
      ) : null,

    muxVideo: ({ value }) =>
      value?.asset?.playbackId ? (
        <div className="my-6">
          <MuxPlayer
            playbackId={value.asset.playbackId}
            streamType="on-demand"
            className="w-full aspect-video rounded-lg shadow"
          />
        </div>
      ) : null,
  },
  block: {
    h2: ({ children }) => (
      <h2 className="text-2xl font-bold text-blue-900 mt-8 mb-3">{children}</h2>
    ),
    normal: ({ children }) => (
      <p className="text-gray-800 leading-relaxed mb-4">{children}</p>
    ),
  },
};

export default function PortableTextRenderer({ value }: { value: any }) {
  return (
    <article className="prose prose-blue max-w-none">
      <PortableText value={value} components={components} />
    </article>
  );
}

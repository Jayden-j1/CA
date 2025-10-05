// components/course/VideoPlayer.tsx
//
// Purpose:
// - Simple, dependency-free HTML5 video player wrapper.
// - Clean fallback and poster support.
//
// Notes:
// - You can later swap this to Mux/Cloudflare/Video.js without touching callers.

"use client";

import React from "react";

interface VideoPlayerProps {
  src: string;
  title: string;
  poster?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, title, poster }) => {
  return (
    <div className="w-full aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
      <video
        key={src} // force reload when src changes
        controls
        poster={poster}
        className="h-full w-full"
      >
        <source src={src} />
        {/* Future: captions track (WCAG) */}
        {/* <track kind="captions" src="..." srclang="en" label="English" default /> */}
        Your browser does not support the video tag for {title}.
      </video>
    </div>
  );
};

export default VideoPlayer;

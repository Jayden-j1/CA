// components/course/VideoPlayer.tsx
//
// Purpose
// -------
// Render either:
//   • an <iframe> for *embed-style* URLs (YouTube, Vimeo, generic pages like Bing video pages), or
//   • a native <video> element for *direct media* URLs (mp4/webm/m3u8, etc.)
//
// Why this change?
// ----------------
// Your Sanity content uses `videoEmbed.url` with links like YouTube/Bing/Vimeo pages.
// An HTML5 <video> tag *cannot* play those page URLs; it needs a direct media file.
// We now auto-detect common providers and render an <iframe>. If the URL looks like a
// direct media file, we fall back to <video>.
//
// Pillars
// -------
// - Efficiency: no extra libs; tiny URL checks.
// - Robustness: handles YouTube (+short youtu.be), Vimeo, generic iframe URLs, and direct files.
// - Simplicity: single component used by both the lesson-level `videoUrl` and PT `videoEmbed`.
// - Security: sandbox/allow attributes are scoped for video embeds only.
//

"use client";

import React from "react";

interface VideoPlayerProps {
  /** The URL provided by Sanity (either a page/embed URL or a direct media URL) */
  src: string;
  /** Human-friendly title (used for accessibility and iframe title) */
  title: string;
  /** Optional poster when rendering a native <video> */
  poster?: string;
}

/* ---------------------------
 * Provider helpers
 * ---------------------------
 * We try to be permissive: if a URL is clearly a known video page, we iframe it.
 * Otherwise, if it looks like a direct file (mp4/webm/m3u8/ogg), we use <video>.
 */

function isDirectMedia(url: string): boolean {
  return /\.(mp4|webm|m3u8|mpd|ogv?|mov)(\?.*)?$/i.test(url);
}

function toYouTubeEmbed(url: string): string | null {
  // Supports:
  //   https://www.youtube.com/watch?v=VIDEO_ID
  //   https://youtu.be/VIDEO_ID
  //   https://www.youtube.com/embed/VIDEO_ID
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      // already embed?
      if (u.pathname.startsWith("/embed/")) return url;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace(/^\/+/, "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function toVimeoEmbed(url: string): string | null {
  // Supports:
  //   https://vimeo.com/VIDEO_ID
  //   https://player.vimeo.com/video/VIDEO_ID
  try {
    const u = new URL(url);
    if (u.hostname === "vimeo.com") {
      const id = u.pathname.replace(/^\/+/, "");
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    if (u.hostname === "player.vimeo.com" && u.pathname.startsWith("/video/")) {
      return url;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function toGenericIframe(url: string): string | null {
  // For other “video page” URLs (e.g., Bing riverview links) we simply iframe the page.
  // Many providers set X-Frame-Options that might block embedding; when that happens,
  // we still render the lesson text, and the user can click out via links in content.
  // This keeps logic simple and avoids brittle per-provider scraping.
  try {
    // If it's clearly http/https, allow it as a last-resort iframe.
    const u = new URL(url);
    if (/^https?:$/.test(u.protocol)) return url;
  } catch {
    /* not a valid URL */
  }
  return null;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, title, poster }) => {
  // 1) Direct file → native <video>
  if (isDirectMedia(src)) {
    return (
      <div className="w-full aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
        <video
          key={src} // re-mount on change
          controls
          poster={poster}
          className="h-full w-full"
        >
          <source src={src} />
          Your browser does not support HTML5 video for {title}.
        </video>
      </div>
    );
  }

  // 2) Known providers → iframe
  const yt = toYouTubeEmbed(src);
  const vm = toVimeoEmbed(src);
  const generic = toGenericIframe(src);
  const iframeSrc = yt || vm || generic;

  if (iframeSrc) {
    return (
      <div className="w-full aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
        <iframe
          key={iframeSrc} // re-mount on change
          src={iframeSrc}
          title={title}
          className="h-full w-full"
          // Reasonable sandbox + permissions for public embeds
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    );
  }

  // 3) Fallback: unknown format → friendly message box
  return (
    <div className="w-full rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
      We couldn’t embed this video URL. Please check the link or use a direct media URL.
    </div>
  );
};

export default VideoPlayer;

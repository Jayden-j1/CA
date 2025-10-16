// postcss.config.mjs
//
// Purpose
// -------
// Single PostCSS config for both Next.js and Sanity Studio.
// Tailwind v4 requires the new @tailwindcss/postcss plugin.
//
// Pillars
// -------
// - Simplicity: one plugin, one export
// - Robustness: supported by both Webpack (Next) and Vite (Sanity)
// - Compatibility: no ESM interop issues

/** @type {import('postcss-load-config').Config} */
export default {
  plugins: {
    // Tailwind v4 PostCSS plugin:
    "@tailwindcss/postcss": {},
  },
};

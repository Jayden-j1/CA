// next.config.ts
//
// Purpose
// -------
// Allow Next.js <Image> to optimize Sanity-hosted images.
// We scope remotePatterns to the exact Sanity images path to keep it secure.
//
// Why this change?
// ----------------
// • Sanity image URLs look like:
//   https://cdn.sanity.io/images/<projectId>/<dataset>/<assetId>-<w>x<h>.<ext>
// • Next.js requires a matching remotePattern (including pathname) to serve images.
// • Wildcard hostnames (e.g. "*.cdn.sanity.io") are NOT supported by Next.js.
//
// Safety
// ------
// • No changes to any other Next.js config options or app logic.

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* existing config options stay intact */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        // ✅ Constrain to the Sanity images route
        //    This matches: /images/<projectId>/<dataset>/<assetId>-<w>x<h>.<ext>
        pathname: "/images/**",
      },
    ],
  },
};

export default nextConfig;









// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
// };

// export default nextConfig;

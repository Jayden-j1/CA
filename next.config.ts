import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* existing config options stay intact */
  images: {
    // ✅ Allow Sanity CDN image domains so <Image /> can render thumbnails
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
      },
      {
        protocol: "https",
        hostname: "*.cdn.sanity.io", // future-proof (some regions use subdomains)
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

import type { NextConfig } from "next";
 
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Images and icons in /public (bg.png, logos, /icons/*, run
        // backgrounds...). Without this, Vercel tells the browser to
        // re-check every image on every page load, and each check is a
        // CDN request (the 304s in your logs).
        // If you replace an image but keep the same file name, visitors
        // may see the old one for up to a day, so give it a new name.
        source: "/:all*(png|jpg|jpeg|gif|webp|svg|ico)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        // Background videos (home.webm, Bankpage.webm, theme videos).
        // These are large and the browser fetches them in several chunks,
        // so re-checking them on every visit costs both requests and
        // bandwidth.
        source: "/:all*(webm|mp4)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};
 
export default nextConfig;
 
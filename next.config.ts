import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Keep Vercel image transformations at zero on the free tier.
    unoptimized: true,
  },
  async rewrites() {
    return [
      { source: "/en", destination: "/?_sl=en" },
      { source: "/en/:path*", destination: "/:path*?_sl=en" },
    ];
  },
};

export default nextConfig;

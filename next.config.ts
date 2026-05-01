import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Keep Vercel image transformations at zero on the free tier.
    unoptimized: true,
  },
  async rewrites() {
    return [
      { source: "/en", destination: "/" },
      { source: "/en/:path*", destination: "/:path*" },
    ];
  },
};

export default nextConfig;

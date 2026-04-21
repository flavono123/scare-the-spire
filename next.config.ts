import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Keep Vercel image transformations at zero on the free tier.
    unoptimized: true,
  },
};

export default nextConfig;

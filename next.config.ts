import type { NextConfig } from "next";

const configuredBuildId = process.env.NEXT_BUILD_ID?.trim();

const nextConfig: NextConfig = {
  staticPageGenerationTimeout: 420,
  ...(configuredBuildId
    ? {
        generateBuildId: async () => configuredBuildId,
      }
    : {}),
  async redirects() {
    return [
      {
        source: "/ko",
        destination: "/",
        permanent: true,
      },
      {
        source: "/ko/:path*",
        destination: "/:path*",
        permanent: true,
      },
      {
        source: "/kor",
        destination: "/",
        permanent: true,
      },
      {
        source: "/kor/:path*",
        destination: "/:path*",
        permanent: true,
      },
    ];
  },
  images: {
    // Keep Vercel image transformations at zero on the free tier.
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/spine/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/generated/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/api/search-index",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/comment-entities/sts2",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

import os from "node:os";
import type { NextConfig } from "next";

const configuredBuildId = process.env.NEXT_BUILD_ID?.trim();

function lanDevOrigins(): string[] {
  const fromEnv = (process.env.NEXT_DEV_ALLOWED_ORIGINS ?? "")
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const hosts = new Set(fromEnv);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.internal) continue;
      if (addr.family === "IPv4" || addr.family === 4) {
        hosts.add(addr.address);
      }
    }
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  // Next 16 blocks non-localhost Hosts in `next dev`. LAN IPv4s let a phone
  // on the same Wi-Fi open the Network URL. Extra hosts: NEXT_DEV_ALLOWED_ORIGINS.
  allowedDevOrigins: lanDevOrigins(),
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
  async rewrites() {
    return [
      { source: "/cards", destination: "/compendium/sts1/cards" },
      { source: "/cards/:id", destination: "/compendium/sts1/cards/:id" },
      { source: "/relics", destination: "/compendium/sts1/relics" },
      { source: "/relics/:id", destination: "/compendium/sts1/relics/:id" },
      { source: "/potions", destination: "/compendium/sts1/potions" },
      { source: "/potions/:id", destination: "/compendium/sts1/potions/:id" },
      { source: "/compendium/sts2/:type", destination: "/compendium/:type" },
      { source: "/compendium/sts2/:type/:id", destination: "/compendium/:type/:id" },
      { source: "/:locale/compendium/sts2/:type", destination: "/:locale/compendium/:type" },
      { source: "/:locale/compendium/sts2/:type/:id", destination: "/:locale/compendium/:type/:id" },
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
        source: "/spine/:path*.atlas",
        headers: [
          {
            key: "Content-Type",
            value: "text/plain; charset=utf-8",
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

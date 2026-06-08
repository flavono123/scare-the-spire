import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Keep Vercel image transformations at zero on the free tier.
    unoptimized: true,
  },
  async redirects() {
    const compendiumDetailRedirects = [
      { source: "/compendium/ancients/:id", destination: "/compendium/ancients?ancient=:id" },
      { source: "/compendium/cards/:id", destination: "/compendium/cards?card=:id" },
      { source: "/compendium/enchantments/:id", destination: "/compendium/enchantments?enchantment=:id&affliction=:id" },
      { source: "/compendium/encounters/:id", destination: "/compendium/bestiary?view=encounters&encounter=:id" },
      { source: "/compendium/epochs/:id", destination: "/compendium/epochs?epoch=:id" },
      { source: "/compendium/events/:id", destination: "/compendium/events?event=:id" },
      { source: "/compendium/monsters/:id", destination: "/compendium/bestiary?monster=:id" },
      { source: "/compendium/potions/:id", destination: "/compendium/potions?potion=:id" },
      { source: "/compendium/powers/:id", destination: "/compendium/powers?power=:id" },
      { source: "/compendium/relics/:id", destination: "/compendium/relics?relic=:id" },
    ].flatMap(({ source, destination }) => [
      { source, destination, permanent: false },
      { source: "/:gameLocale" + source, destination: "/:gameLocale" + destination, permanent: false },
    ]);

    return compendiumDetailRedirects;
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

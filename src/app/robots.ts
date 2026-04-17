import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep core pages crawlable, but block high-cardinality/heavy sections.
        disallow: ["/codex", "/chemical-x", "/dev"],
      },
    ],
    host: "https://scare-the-spire.vercel.app",
  };
}

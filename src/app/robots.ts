import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/site-origin";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep core pages crawlable, but block high-cardinality/heavy sections.
        disallow: ["/codex", "/compendium", "/chemical-x", "/dev"],
      },
    ],
    host: getSiteOrigin(),
  };
}

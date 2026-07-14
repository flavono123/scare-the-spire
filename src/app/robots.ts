import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site-origin";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep core pages crawlable, but block high-cardinality/heavy sections.
        disallow: ["/codex", "/chemical-x", "/this-or-that", "/dev"],
      },
    ],
    host: SITE_ORIGIN,
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}

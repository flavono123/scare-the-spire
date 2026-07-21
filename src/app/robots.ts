import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site-origin";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "Amazonbot",
        disallow: "/",
      },
      {
        userAgent: "GPTBot",
        disallow: "/",
      },
      {
        userAgent: "meta-externalagent",
        disallow: "/",
      },
      {
        userAgent: "*",
        allow: "/",
        // Keep duplicate legacy routes and internal development pages out of search.
        disallow: ["/codex", "/dev"],
      },
    ],
    host: SITE_ORIGIN,
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}

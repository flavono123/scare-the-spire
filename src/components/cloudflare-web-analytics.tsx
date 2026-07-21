import Script from "next/script";

const DEFAULT_CLOUDFLARE_WEB_ANALYTICS_TOKEN =
  "a505206e64e843ba88936f23d296cd3b";

export function CloudflareWebAnalytics() {
  const token =
    process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN ||
    DEFAULT_CLOUDFLARE_WEB_ANALYTICS_TOKEN;

  return (
    <Script
      id="cloudflare-web-analytics"
      type="module"
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
      data-cf-beacon={JSON.stringify({ token })}
    />
  );
}

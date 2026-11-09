/**
 * The response header policy of both Workers. Cloudflare applies the `/*` rule
 * of `public/_headers` to every asset response, direct or through
 * `env.ASSETS.fetch`; `withSecurityHeaders` covers the responses a Worker builds
 * itself. `pnpm test:security-headers` fails when the two differ.
 *
 * The CSP stays Report-Only until browser QA counts no violations. Enforcing it
 * means renaming the header in both places and adding
 * `upgrade-insecure-requests`, which browsers reject in a Report-Only policy.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Prerendered HTML has no per-request nonce, and Next inlines its RSC flight.
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  // Link previews show og:image from any https host.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // The editors ask YouTube oEmbed for pasted video titles from the browser.
  // Step 6: the browser calls only the same-origin /api, never Supabase.
  "connect-src 'self' https://cloudflareinsights.com https://www.youtube.com",
  "frame-src 'self' https://www.youtube-nocookie.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Content-Security-Policy-Report-Only": CONTENT_SECURITY_POLICY,
};

/** Redirect and service binding responses have immutable headers, so copy first. */
export function withSecurityHeaders(response: Response): Response {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    secured.headers.set(name, value);
  }
  return secured;
}

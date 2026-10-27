// Mirrors redactPathname in scripts/cloudflare-worker-logs.mjs so Worker log
// lines never carry user record IDs.
const UNBOUNDED_ID_PREFIXES = [
  /^(\/(?:[a-z]{2}(?:-[0-9]+)?\/)?(?:this-or-that|transfigure|chemical-x|c-c-c-combo|history-course|decisions-decisions|pagestorm))\/[^/]+$/i,
  /^(\/defragment\/(?:chemical_x|combo|transfigure|this_or_that))\/[^/]+$/i,
];

export function redactPathname(pathname: string): string {
  let value = (pathname || "/").split("?")[0] || "/";
  value = value.replace(/\/REDACTED(?=\/|$)/g, "/{id}");
  value = value.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi,
    "/{id}",
  );
  for (const pattern of UNBOUNDED_ID_PREFIXES) {
    value = value.replace(pattern, "$1/{id}");
  }
  return value;
}

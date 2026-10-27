/**
 * Runs the real main Worker against every prerendered Next route, with the
 * built static asset directory behind a local ASSETS binding, and fails when a
 * public route would need a renderer. Each route must resolve to a static page,
 * the patch Worker, the same redirect its prerender returned, or (dev pages
 * and the not-found page) the static 404.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { CLOUDFLARE_ASSETS_DIR } from "./cloudflare-assets-dir.mjs";

const appDir = path.join(".next", "server", "app");
const assetsRoot = CLOUDFLARE_ASSETS_DIR;
const origin = "https://coverage.local";

// The static Compendium copy predates this check: these index routes prerender
// a 307 to the bestiary but are served as static pages (200 meta refresh).
const STATIC_REDIRECT_PAGES = /^\/(?:[a-z]{2}(?:-\d+)?\/)?compendium\/(?:encounters|monsters)$/;

interface PrerenderMeta {
  status?: number;
  headers?: Record<string, string>;
}

type Outcome = "static" | "patch" | "redirect" | "not-found";

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

function assetFile(assetPath: string): string | null {
  const file = path.join(assetsRoot, decodeURIComponent(assetPath).replace(/^\/+/, ""));
  return statSync(file, { throwIfNoEntry: false })?.isFile() ? file : null;
}

/** Workers Static Assets with the default `html_handling: auto-trailing-slash`. */
async function fetchAsset(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  const redirect = (location: string) => new Response(null, { status: 307, headers: { Location: location } });
  const serve = (file: string) => new Response(request.method === "HEAD" ? null : readFileSync(file), { status: 200 });

  if (pathname.endsWith("/index.html") && assetFile(pathname)) return redirect(pathname.slice(0, -"index.html".length));
  if (pathname.endsWith(".html") && assetFile(pathname)) return redirect(pathname.slice(0, -".html".length));
  if (pathname.endsWith("/")) {
    const index = assetFile(`${pathname}index.html`);
    if (index) return serve(index);
    if (assetFile(`${pathname.slice(0, -1)}.html`)) return redirect(pathname.slice(0, -1));
    return new Response(null, { status: 404 });
  }
  const exact = assetFile(pathname) ?? assetFile(`${pathname}.html`);
  if (exact) return serve(exact);
  if (assetFile(`${pathname}/index.html`)) return redirect(`${pathname}/`);
  return new Response(null, { status: 404 });
}

function readMeta(htmlFile: string): PrerenderMeta {
  const metaFile = htmlFile.replace(/\.html$/, ".meta");
  return existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, "utf8")) as PrerenderMeta : {};
}

function routePathForHtml(htmlFile: string): string {
  const relative = path.relative(appDir, htmlFile).split(path.sep).join("/").replace(/\.html$/, "");
  return relative === "index" ? "/" : `/${relative}`;
}

async function main() {
  if (!statSync(appDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`${appDir} does not exist. Run next build first.`);
  }
  if (!statSync(assetsRoot, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`${assetsRoot} does not exist. Run the Cloudflare asset collector first.`);
  }

  // No network and no Supabase lookups: the Worker must answer from assets.
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_URL", "SUPABASE_ANON_KEY"]) {
    delete process.env[key];
  }
  globalThis.fetch = (() => Promise.reject(new Error("network disabled in route coverage check"))) as typeof fetch;
  (globalThis as { HTMLRewriter?: unknown }).HTMLRewriter = class {
    on() {
      return this;
    }
    transform(response: Response) {
      return response;
    }
  };
  const log = console.log;
  console.log = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("cf-static-404 ")) return;
    log(...args);
  };

  const { default: mainWorker } = await import("../workers/main-worker");
  const env = {
    ASSETS: { fetch: fetchAsset },
    PATCH_WORKER: {
      fetch: async () => new Response("patch", { status: 200, headers: { "x-coverage-owner": "patch" } }),
    },
  };
  const ctx = { waitUntil() {} };

  const counts: Record<Outcome, number> = { static: 0, patch: 0, redirect: 0, "not-found": 0 };
  const failures: string[] = [];
  const htmlFiles = walk(appDir).filter((file) => file.endsWith(".html"));

  for (const htmlFile of htmlFiles) {
    const routePath = routePathForHtml(htmlFile);
    if (routePath === "/_global-error") continue;

    const meta = readMeta(htmlFile);
    const status = meta.status ?? 200;
    const location = meta.headers?.location;

    for (const rsc of [false, true]) {
      const headers: Record<string, string> = rsc ? { RSC: "1" } : { Accept: "text/html" };
      const response: Response = await mainWorker.fetch(
        new Request(`${origin}${routePath}`, { headers }),
        env,
        ctx,
      );
      await response.body?.cancel();
      const owner = response.headers.get("x-cf-static-page");
      const label = `${routePath} (${rsc ? "rsc" : "document"})`;
      let outcome: Outcome | null = null;

      if (response.headers.get("x-coverage-owner") === "patch") {
        outcome = "patch";
      } else if (status === 404) {
        if (response.status === 404 && owner === "not-found") outcome = "not-found";
      } else if ((status === 307 || status === 308) && !STATIC_REDIRECT_PAGES.test(routePath)) {
        if (response.status === status && response.headers.get("location") === location) outcome = "redirect";
      } else if (response.status === 200 && owner && owner !== "not-found") {
        outcome = "static";
      }

      if (outcome) counts[outcome] += 1;
      else {
        failures.push(
          `${label}: prerender ${status}${location ? ` -> ${location}` : ""}, Worker ${response.status}`
          + `${owner ? ` x-cf-static-page=${owner}` : ""}${response.headers.get("location") ? ` -> ${response.headers.get("location")}` : ""}`,
        );
      }
    }
  }

  console.log(
    `Cloudflare route coverage: ${htmlFiles.length} prerendered routes x document/RSC · `
    + `static=${counts.static} patch=${counts.patch} redirect=${counts.redirect} not-found=${counts["not-found"]}`,
  );
  if (failures.length > 0) {
    console.error(`${failures.length} prerendered request(s) need a renderer or changed behavior:`);
    for (const failure of failures.slice(0, 50)) console.error(`- ${failure}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});

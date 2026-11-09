/**
 * Build-time reads of the site's own /api (src/lib/build-api-read.ts) for the
 * shell patch reels: a read ends at its deadline, a production build stops
 * instead of baking sample posts, anything but a router answer for the build's
 * data env is a failed read, and the reels bake the rows those routes answer.
 * Run: pnpm exec tsx scripts/build-api-read.spec.ts
 */
import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import {
  buildApiOrigin,
  PRODUCTION_SITE_ORIGIN,
  TESTBED_SITE_ORIGIN,
} from "../src/lib/build-api-read";
import { getColorfulPhilosopherGalleryPosts } from "../src/lib/colorful-philosophers-gallery";
import { addColorfulPhilosophersDays, colorfulPhilosophersWeekStart } from "../src/lib/colorful-philosophers";
import { BUILTIN_SAMPLE_TRANSFIGURES } from "../src/lib/transfigure-builtins";
import { getRecentTransfigurePosts } from "../src/lib/transfigure-data";

const TIMEOUT_MS = 200;
const LOOSE_BOUND_MS = 3_000;

type Answer = { status?: number; body?: unknown; marker?: boolean; env?: string | null };
type Route = (url: URL) => Answer;

type Stub = { origin: string; requests: string[]; close(): void };

const servers: Stub[] = [];

/** A Worker stand-in: `routes` by pathname, or never answering when `routes` is null. */
async function stub(routes: Record<string, Route> | null): Promise<Stub> {
  const requests: string[] = [];
  const server = createServer((request, response: ServerResponse) => {
    const url = new URL(request.url ?? "/", "http://stub");
    requests.push(`${url.pathname}${url.search}`);
    if (!routes) return; // Never answers, like a stalled Worker.
    const answer = routes[url.pathname]?.(url) ?? { status: 404, body: { error: "not_found" } };
    const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8" };
    if (answer.marker !== false) headers["X-Slseoun-Api"] = "1";
    if (answer.env) headers["X-Slseoun-Api-Env"] = answer.env;
    response.writeHead(answer.status ?? 200, headers);
    response.end(JSON.stringify(answer.body ?? null));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const handle = {
    origin: `http://127.0.0.1:${port}`,
    requests,
    close() {
      server.closeAllConnections();
      server.close();
    },
  };
  servers.push(handle);
  return handle;
}

async function timed<T>(run: () => Promise<T>): Promise<T> {
  const started = performance.now();
  try {
    return await run();
  } finally {
    assert.ok(performance.now() - started < LOOSE_BOUND_MS, "the read must end at its deadline");
  }
}

function feedRow(index: number, env: string) {
  const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
  const createdAt = new Date(Date.UTC(2026, 10, 9, 0, 0, 0) - index * 60_000).toISOString();
  return {
    id,
    created_at: createdAt,
    like_count: index,
    comment_count: 1,
    recommend_score: index * 4 + 6,
    post: {
      id,
      env,
      title: `post ${index}`,
      nickname: "spec",
      resource_type: "card",
      resource_id: "BASH",
      created_at: createdAt,
      like_count: index,
      comment_count: 1,
      content: [{ type: "text", text: "body" }],
    },
  };
}

function feed(env: string, count: number): Record<string, Route> {
  return {
    "/api/read/toybox-feed": (url) => {
      assert.equal(url.searchParams.get("service"), "transfigure");
      assert.equal(url.searchParams.get("sort"), "latest");
      return { env, body: Array.from({ length: count }, (_, index) => feedRow(index, env)) };
    },
  };
}

function reelRow(id: string, weekStart: string, slot: string, resourceType: string, resourceId: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    week_start: weekStart,
    slot,
    resource_type: resourceType,
    resource_id: resourceId,
    name_ko: `${resourceId} ko`,
    name_en: `${resourceId} en`,
    image_url: null,
    body: `${slot} body`,
    game_version: "0.111.0",
    ...extra,
  };
}

async function main() {
  process.env.BUILD_API_TIMEOUT_MS = String(TIMEOUT_MS);
  delete process.env.ALLOW_BUILD_WITHOUT_API;
  delete process.env.ALLOW_BUILD_WITHOUT_SUPABASE;
  delete process.env.BUILD_API_ORIGIN;
  delete process.env.NEXT_PUBLIC_SITE_ORIGIN;

  const logged: string[] = [];
  const realError = console.error;
  console.error = (message: unknown) => logged.push(String(message));

  try {
    // Which deployment answers for which data env.
    process.env.NEXT_PUBLIC_SUPABASE_ENV = "production";
    assert.equal(buildApiOrigin("production"), PRODUCTION_SITE_ORIGIN);
    assert.equal(PRODUCTION_SITE_ORIGIN, "https://scare-the-spire.flavono123.workers.dev");
    process.env.NEXT_PUBLIC_SITE_ORIGIN = "https://example.test/some/path";
    assert.equal(buildApiOrigin("production"), "https://example.test");
    assert.equal(buildApiOrigin("development"), TESTBED_SITE_ORIGIN);
    assert.equal(TESTBED_SITE_ORIGIN, "https://scare-the-spire-testbed.flavono123.workers.dev");
    assert.equal(buildApiOrigin("testbed"), null);
    process.env.BUILD_API_ORIGIN = "http://127.0.0.1:8787";
    assert.equal(buildApiOrigin("production"), "http://127.0.0.1:8787", "the override points the build's own env");
    assert.equal(buildApiOrigin("development"), TESTBED_SITE_ORIGIN, "and only that env");
    delete process.env.BUILD_API_ORIGIN;

    // A Worker that never answers: a production build stops.
    const silent = await stub(null);
    process.env.NEXT_PUBLIC_SITE_ORIGIN = silent.origin;
    await assert.rejects(timed(() => getRecentTransfigurePosts(1)), /\[build-data\] transfigure feed/);
    await assert.rejects(timed(() => getColorfulPhilosopherGalleryPosts()), /\[build-data\] colorful philosophers reel/);
    assert.equal(logged.length, 2);
    assert.ok(logged.every((line) => line.includes("Failing this production build")));
    assert.ok(logged.every((line) => line.includes("ALLOW_BUILD_WITHOUT_API=1")));

    // The override releases with fallback data, under its new name and its old one.
    logged.length = 0;
    process.env.ALLOW_BUILD_WITHOUT_API = "1";
    assert.equal((await timed(() => getRecentTransfigurePosts(2))).length, BUILTIN_SAMPLE_TRANSFIGURES.length);
    assert.deepEqual(await timed(() => getColorfulPhilosopherGalleryPosts()), []);
    assert.equal(logged.length, 2);
    assert.ok(logged.every((line) => line.includes("THIS BUILD CONTAINS FALLBACK DATA")));
    delete process.env.ALLOW_BUILD_WITHOUT_API;

    logged.length = 0;
    process.env.ALLOW_BUILD_WITHOUT_SUPABASE = "1";
    assert.equal((await timed(() => getRecentTransfigurePosts(3))).length, BUILTIN_SAMPLE_TRANSFIGURES.length);
    assert.equal(logged.length, 1);
    assert.ok(logged[0].includes("THIS BUILD CONTAINS FALLBACK DATA"));
    delete process.env.ALLOW_BUILD_WITHOUT_SUPABASE;

    // Anything but a router answer for this env is a failed read.
    const week = colorfulPhilosophersWeekStart();
    const failures: Array<[string, Record<string, Route>]> = [
      ["409 surface_legacy", {
        "/api/read/toybox-feed": () => ({ status: 409, body: { error: "surface_legacy", reason: "flag" } }),
        "/api/read/colorful-philosophers/reel": () => ({ status: 409, body: { error: "surface_legacy", reason: "flag" } }),
      }],
      ["503 unavailable", {
        "/api/read/toybox-feed": () => ({ status: 503, body: { error: "unavailable" } }),
        "/api/read/colorful-philosophers/reel": () => ({ status: 503, body: { error: "unavailable" } }),
      }],
      ["no router marker", {
        "/api/read/toybox-feed": () => ({ marker: false, env: "production", body: [feedRow(0, "production")] }),
        "/api/read/colorful-philosophers/reel": () => ({ marker: false, body: { v: 1, env: "production", posts: [reelRow("a", week, "topic", "character", "IRONCLAD")] } }),
      }],
      ["another env's rows", {
        "/api/read/toybox-feed": () => ({ env: "development", body: [feedRow(0, "development")] }),
        "/api/read/colorful-philosophers/reel": () => ({ body: { v: 1, env: "development", posts: [reelRow("a", week, "topic", "character", "IRONCLAD")] } }),
      }],
      ["a v1 answer without rows", {
        "/api/read/toybox-feed": () => ({ body: { v: 1, env: "production" } }),
        "/api/read/colorful-philosophers/reel": () => ({ body: { v: 1, env: "production" } }),
      }],
      ["an empty production feed", {
        "/api/read/toybox-feed": () => ({ env: "production", body: [] }),
        "/api/read/colorful-philosophers/reel": () => ({ body: { v: 2, env: "production", posts: [] } }),
      }],
    ];
    for (const [label, routes] of failures) {
      logged.length = 0;
      const server = await stub(routes);
      process.env.NEXT_PUBLIC_SITE_ORIGIN = server.origin;
      await assert.rejects(timed(() => getRecentTransfigurePosts(15)), /Failing|could not read/, label);
      await assert.rejects(timed(() => getColorfulPhilosopherGalleryPosts()), /could not read/, label);
      assert.equal(logged.length, 2, label);
    }

    // Production rows: the first 15 of the latest feed page, in feed order, and
    // the reel week with its reaction totals.
    logged.length = 0;
    const live = await stub({
      ...feed("production", 20),
      "/api/read/colorful-philosophers/reel": () => ({
        body: {
          v: 1,
          env: "production",
          posts: [
            reelRow("relic-post", week, "relic", "relic", "PANTOGRAPH"),
            reelRow("topic-post", week, "topic", "character", "NECROBINDER"),
            reelRow("card-post", week, "card", "card", "BASH"),
            reelRow("old-post", addColorfulPhilosophersDays(week, -7), "card", "card", "STRIKE"),
            { id: "broken", week_start: week },
          ],
        },
      }),
      "/api/read/engagement": (url) => ({
        body: {
          v: 1,
          env: "production",
          reactions: url.searchParams.get("reactions") === null ? {} : {
            "character:NECROBINDER:0.111.0": { buff: 0, nerf: 3, rework: 1 },
            "card:BASH:0.111.0": { buff: 2, nerf: 0, rework: 0 },
          },
        },
      }),
    });
    process.env.NEXT_PUBLIC_SITE_ORIGIN = live.origin;
    const posts = await getRecentTransfigurePosts(15);
    assert.equal(posts.length, 15);
    assert.deepEqual(posts.map((post) => post.id), Array.from({ length: 15 }, (_, index) => feedRow(index, "production").id));
    assert.equal(posts[3].title, "post 3", "the nested post row is the post");
    assert.equal(posts[3].like_count, 3);
    assert.equal(posts[3].comment_count, 1);
    assert.equal(await getRecentTransfigurePosts(15), await getRecentTransfigurePosts(15), "one read per build");

    const reel = await getColorfulPhilosopherGalleryPosts();
    await getColorfulPhilosopherGalleryPosts();
    assert.deepEqual(reel.map((post) => post.id), ["topic-post", "card-post", "relic-post"]);
    assert.deepEqual(reel.map((post) => [post.buffCount, post.nerfCount, post.reworkCount]), [[0, 3, 1], [2, 0, 0], [0, 0, 0]]);
    const reelReads = live.requests.filter((request) => request.startsWith("/api/read/colorful-philosophers/reel"));
    assert.equal(reelReads.length, 1, "every language shares one read");
    const countReads = live.requests.filter((request) => request.startsWith("/api/read/engagement"));
    assert.equal(countReads.length, 1);
    const asked = new URL(countReads[0], "http://stub").searchParams.get("reactions")?.split(",").sort();
    assert.deepEqual(asked, ["card:BASH:0.111.0", "character:NECROBINDER:0.111.0", "relic:PANTOGRAPH:0.111.0"]);
    assert.equal(logged.length, 0);

    // A development build bakes its own rows, and borrows production's when it has none.
    logged.length = 0;
    process.env.NEXT_PUBLIC_SUPABASE_ENV = "development";
    const emptyDevelopment = await stub({
      ...feed("development", 0),
      "/api/read/colorful-philosophers/reel": () => ({ body: { v: 1, env: "development", posts: [] } }),
    });
    process.env.BUILD_API_ORIGIN = emptyDevelopment.origin;
    const borrowed = await getRecentTransfigurePosts(15);
    assert.deepEqual(borrowed.map((post) => post.id), posts.map((post) => post.id));
    assert.deepEqual(await getColorfulPhilosopherGalleryPosts(), [], "the reel borrows nothing");
    assert.equal(logged.length, 0);

    const development = await stub({
      ...feed("development", 4),
      "/api/read/colorful-philosophers/reel": () => ({
        body: {
          v: 1,
          env: "development",
          posts: [
            reelRow("dev-topic", week, "topic", "character", "IRONCLAD", { buff_count: 5 }),
            reelRow("dev-card", week, "card", "card", "TEAR_ASUNDER"),
          ],
        },
      }),
      "/api/read/engagement": () => ({ status: 503, body: { error: "unavailable" } }),
    });
    process.env.BUILD_API_ORIGIN = development.origin;
    assert.equal((await getRecentTransfigurePosts(15)).length, 4);
    const devReel = await getColorfulPhilosopherGalleryPosts();
    assert.deepEqual(devReel.map((post) => [post.id, post.buffCount]), [["dev-topic", 5], ["dev-card", 0]], "failed totals keep the posts' own counts");
    assert.equal(logged.length, 0, "a failed total read is not a failed reel");

    // A target outside the Worker's key rule is not asked for: the posts keep their counts.
    const oddTarget = await stub({
      "/api/read/colorful-philosophers/reel": () => ({
        body: { v: 1, env: "development", posts: [reelRow("odd", week, "card", "card", "BASH:1", { nerf_count: 2 })] },
      }),
    });
    process.env.BUILD_API_ORIGIN = oddTarget.origin;
    const oddReel = await getColorfulPhilosopherGalleryPosts();
    assert.deepEqual(oddReel.map((post) => [post.id, post.nerfCount]), [["odd", 2]]);
    assert.equal(oddTarget.requests.filter((request) => request.startsWith("/api/read/engagement")).length, 0);

    // A development build that cannot read logs and bakes fallback data.
    logged.length = 0;
    const silentDevelopment = await stub(null);
    process.env.BUILD_API_ORIGIN = silentDevelopment.origin;
    assert.equal((await timed(() => getRecentTransfigurePosts(7))).length, BUILTIN_SAMPLE_TRANSFIGURES.length);
    assert.deepEqual(await timed(() => getColorfulPhilosopherGalleryPosts()), []);
    assert.equal(logged.length, 2);
    assert.ok(logged.every((line) => line.includes("THIS BUILD CONTAINS FALLBACK DATA")));

    // A data env no deployment serves.
    logged.length = 0;
    delete process.env.BUILD_API_ORIGIN;
    process.env.NEXT_PUBLIC_SUPABASE_ENV = "testbed";
    assert.equal((await getRecentTransfigurePosts(15)).length, BUILTIN_SAMPLE_TRANSFIGURES.length);
    assert.equal(logged.length, 1);
    assert.ok(logged[0].includes('no site origin serves data env "testbed"'));
  } finally {
    console.error = realError;
    for (const server of servers) server.close();
  }
}

main().then(
  () => console.log("build api read spec passed"),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);

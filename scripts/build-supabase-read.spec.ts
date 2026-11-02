/**
 * Build-time Supabase reads against a server that never answers: they must end
 * quickly, and a production build must stop instead of baking in sample posts.
 * Run: pnpm exec tsx scripts/build-supabase-read.spec.ts
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { getColorfulPhilosopherGalleryPosts } from "../src/lib/colorful-philosophers-gallery";
import { BUILTIN_SAMPLE_TRANSFIGURES } from "../src/lib/transfigure-builtins";
import { getRecentTransfigurePosts } from "../src/lib/transfigure-data";

const TIMEOUT_MS = 200;
const LOOSE_BOUND_MS = 3_000;

async function timed<T>(run: () => Promise<T>): Promise<T> {
  const started = performance.now();
  try {
    return await run();
  } finally {
    assert.ok(performance.now() - started < LOOSE_BOUND_MS, "the query must end at its timeout");
  }
}

async function main() {
  const server = createServer(() => {
    // Never answers, like the stalled database.
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "spec-key";
  process.env.BUILD_SUPABASE_TIMEOUT_MS = String(TIMEOUT_MS);

  const logged: string[] = [];
  const realError = console.error;
  console.error = (message: unknown) => logged.push(String(message));

  try {
    process.env.NEXT_PUBLIC_SUPABASE_ENV = "production";
    await assert.rejects(timed(() => getRecentTransfigurePosts(1)), /\[build-data\] transfigure_posts/);
    await assert.rejects(timed(() => getColorfulPhilosopherGalleryPosts()), /\[build-data\] colorful/);
    assert.ok(logged.every((line) => line.includes("Failing this production build")));

    logged.length = 0;
    process.env.ALLOW_BUILD_WITHOUT_SUPABASE = "1";
    assert.equal((await timed(() => getRecentTransfigurePosts(2))).length, BUILTIN_SAMPLE_TRANSFIGURES.length);
    assert.deepEqual(await timed(() => getColorfulPhilosopherGalleryPosts()), []);
    assert.equal(logged.length, 2);
    assert.ok(logged.every((line) => line.includes("THIS BUILD CONTAINS FALLBACK DATA")));
    delete process.env.ALLOW_BUILD_WITHOUT_SUPABASE;

    logged.length = 0;
    process.env.NEXT_PUBLIC_SUPABASE_ENV = "testbed";
    assert.equal((await timed(() => getRecentTransfigurePosts(3))).length, BUILTIN_SAMPLE_TRANSFIGURES.length);
    assert.equal(logged.length, 1);

    logged.length = 0;
    await timed(() => getColorfulPhilosopherGalleryPosts());
    await timed(() => getColorfulPhilosopherGalleryPosts());
    assert.equal(logged.length, 1, "every language shares one read");
  } finally {
    console.error = realError;
    server.closeAllConnections();
    server.close();
  }
}

main().then(
  () => console.log("build supabase read spec passed"),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);

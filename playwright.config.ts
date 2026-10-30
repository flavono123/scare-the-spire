import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./scripts",
  testMatch: [
    "visual-check.spec.ts",
    "potion-tooltip-position.spec.ts",
    "monster-qa.spec.ts",
    "monster-intent-fsm.spec.ts",
    "history-course-shell.spec.ts",
    "history-course-rewards.spec.ts",
    "history-course-playback.spec.ts",
    "phase4-visual.spec.ts",
    "perf-probe.spec.ts",
    "card-tile-visual.spec.ts",
    "enchantment-stat-combinations.spec.ts",
    "codex-filter-search.spec.ts",
    "compendium-index-localization.spec.ts",
    "mobile-ux.spec.ts",
    "text-con-mobile.spec.ts",
    "card-con-mobile.spec.ts",
    "cloudflare-testbed.spec.ts",
    "contact.spec.ts",
  ],
  timeout: 30_000,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    headless: true,
    // Testbed and production share one Supabase project. A suite that does not
    // test Supabase-backed UI keeps its page loads off it. Unlike page.route(),
    // blocking at DNS leaves the HTTP cache on.
    ...(process.env.PLAYWRIGHT_BLOCK_SUPABASE === "1"
      ? { launchOptions: { args: ["--host-resolver-rules=MAP *.supabase.co ~NOTFOUND"] } }
      : {}),
  },
  // Do not start dev server — assume it's already running
  retries: 0,
});

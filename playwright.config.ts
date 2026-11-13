import { defineConfig } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const blockSupabase = process.env.PLAYWRIGHT_BLOCK_SUPABASE === "1";

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
    baseURL,
    headless: true,
    // Testbed and production share one Supabase project. The browser has no
    // Supabase path since step 6, so blocking at DNS only catches a request that
    // should not exist (unlike page.route(), it leaves the HTTP cache on). The
    // Worker's same-origin /api answers from D1 (docs/supabase-exit/STEP6_PLAN.md
    // WP-Q): no QA cookie here. A test that needs the Worker's legacy answer
    // (slseoun_qa=no-supabase, 409 surface_legacy) sets the cookie itself.
    ...(blockSupabase
      ? { launchOptions: { args: ["--host-resolver-rules=MAP *.supabase.co ~NOTFOUND"] } }
      : {}),
  },
  // Do not start dev server — assume it's already running
  retries: 0,
});

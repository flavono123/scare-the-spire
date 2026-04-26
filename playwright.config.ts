import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./scripts",
  testMatch: [
    "visual-check.spec.ts",
    "potion-tooltip-position.spec.ts",
    "monster-qa.spec.ts",
    "history-course-shell.spec.ts",
  ],
  timeout: 30_000,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    headless: true,
  },
  // Do not start dev server — assume it's already running
  retries: 0,
});

// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".open-next/**",
    ".cloudflare/**",
    ".patch-worker/**",
    ".wrangler/**",
    "out/**",
    "build/**",
    "storybook-static/**",
    "public/generated/*.js",
    "next-env.d.ts",
    // Worktrees under .claude hold their own sources and build output.
    ".claude/**",
  ]),
  ...storybook.configs["flat/recommended"],
  // eslint-plugin-react-hooks 7.1 (from eslint-config-next 16.4) reports these
  // long-standing patterns. Only the listed files warn until they are reworked;
  // every other file keeps the rules as errors.
  {
    files: [
      "src/app/(main)/dev/combat-sim/combat-sim-client.tsx",
      "src/app/(main)/profile/profile-page.tsx",
      "src/components/history-course/cover-editor-sheet.tsx",
      "src/components/history-course/prod-runs-dev-section.tsx",
      "src/components/history-course/topbar.tsx",
      "src/components/history-course/treasure-room-stage.tsx",
      "src/components/pagestorm/pagestorm-client.tsx",
      "src/components/rich-content-editor.tsx",
      "src/components/story-composer-modal.tsx",
      "src/components/transfigure/transfigure-editor.tsx",
      "src/hooks/use-colorful-philosopher-posts.ts",
      "src/hooks/use-defragment-feed.ts",
      "src/hooks/use-profile-activity.ts",
      "src/hooks/use-toybox-feed.ts",
    ],
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  {
    files: [
      "src/app/(main)/dev/combat-sim/spine-actor.tsx",
      "src/components/defragment/defragment-write-panel.tsx",
      "src/components/pagestorm/pagestorm-client.tsx",
      "src/components/rich-content-editor.tsx",
      "src/components/transfigure/transfigure-editor.tsx",
      "src/hooks/use-profile-activity.ts",
      "src/hooks/use-toybox-feed.ts",
    ],
    rules: { "react-hooks/refs": "warn" },
  },
  {
    files: ["src/components/pagestorm/pagestorm-editor.tsx"],
    rules: { "react-hooks/preserve-manual-memoization": "warn" },
  },
]);

export default eslintConfig;

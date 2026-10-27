/**
 * Fails when the built site CSS is missing a class that Tailwind generates from
 * src/app/globals.css right now: the build reused stale CSS, for example from a
 * restored .next/cache whose globals.css module lost its dependency snapshot
 * (see the @source not note in globals.css).
 *
 * globals.css is compiled with the PostCSS plugin Next uses (@tailwindcss/postcss
 * from postcss.config.mjs, production optimize), and every class name it yields
 * (CSS escapes decoded) must appear in some .next/static/css/*.css file.
 *
 * Usage: pnpm css:check [--css-dir .next/static/css] [--input src/app/globals.css]
 * Run from the repository root after the Next build.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

type PostcssNode = { type: string; name?: string; parent?: PostcssNode };
type PostcssRule = PostcssNode & { selector: string };
type PostcssRoot = { walkRules(callback: (rule: PostcssRule) => void): void };
type Postcss = {
  (plugins: unknown[]): { process(css: string, options: { from: string; to: string }): Promise<{ root: PostcssRoot }> };
  parse(css: string, options: { from: string }): PostcssRoot;
};

function argValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const root = process.cwd();
const cssDir = path.resolve(root, argValue("--css-dir", ".next/static/css"));
const input = path.resolve(root, argValue("--input", "src/app/globals.css"));

const requireFromRoot = createRequire(path.join(root, "package.json"));
const tailwindPostcss = requireFromRoot("@tailwindcss/postcss") as (options: { optimize: boolean }) => unknown;
const postcss = createRequire(requireFromRoot.resolve("@tailwindcss/postcss"))("postcss") as Postcss;

function decodeCssEscapes(value: string): string {
  return value.replace(/\\([0-9a-fA-F]{1,6})[ \t\n\r\f]?|\\([\s\S])/g, (_, hex: string | undefined, char: string | undefined) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : (char ?? ""),
  );
}

const CLASS_PATTERN = /\.((?:\\[0-9a-fA-F]{1,6}[ \t\n\r\f]?|\\[^\n\r\f]|[\w-]|[^\x00-\x7f])+)/g;

function isInsideKeyframes(node: PostcssNode): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === "atrule" && parent.name && /keyframes$/i.test(parent.name)) return true;
  }
  return false;
}

function collectClasses(tree: PostcssRoot, into: Set<string>): void {
  tree.walkRules((rule) => {
    if (isInsideKeyframes(rule)) return;
    // Quoted attribute values may contain dots that are not class selectors.
    const selector = rule.selector.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
    for (const match of selector.matchAll(CLASS_PATTERN)) into.add(decodeCssEscapes(match[1]));
  });
}

async function main(): Promise<void> {
  if (!fs.existsSync(cssDir)) {
    console.error(`css:check: ${path.relative(root, cssDir)} does not exist. Run the Next build first.`);
    process.exit(1);
  }
  const builtFiles = fs.readdirSync(cssDir).filter((file) => file.endsWith(".css"));
  if (builtFiles.length === 0) {
    console.error(`css:check: no CSS files in ${path.relative(root, cssDir)}.`);
    process.exit(1);
  }

  const built = new Set<string>();
  for (const file of builtFiles) {
    const fullPath = path.join(cssDir, file);
    collectClasses(postcss.parse(fs.readFileSync(fullPath, "utf8"), { from: fullPath }), built);
  }

  const result = await postcss([tailwindPostcss({ optimize: true })]).process(fs.readFileSync(input, "utf8"), {
    from: input,
    to: input,
  });
  const expected = new Set<string>();
  collectClasses(result.root, expected);

  const missing = [...expected].filter((name) => !built.has(name)).sort();
  if (missing.length > 0) {
    console.error(
      `css:check: the built CSS (${builtFiles.length} files in ${path.relative(root, cssDir)}) is missing ` +
        `${missing.length} of ${expected.size} classes that ${path.relative(root, input)} generates now:`,
    );
    for (const name of missing.slice(0, 50)) console.error(`  .${name}`);
    if (missing.length > 50) console.error(`  ... and ${missing.length - 50} more`);
    console.error(
      "The build reused stale CSS. Delete .next/cache/webpack (in CI, bump the Next.js cache key) and rebuild.",
    );
    process.exit(1);
  }
  console.log(
    `css:check: all ${expected.size} classes from ${path.relative(root, input)} are in the built CSS ` +
      `(${builtFiles.length} files).`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

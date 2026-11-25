import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

// Stage 1 (scripts/generate-source-json.ts) writes src/generated/*.json for stage 2 and
// the app. If it reached one of those files, even through place-registry or another lib,
// a clean checkout could not run it. Walks every import, type-only and dynamic ones too.

const root = process.cwd();
const configPath = path.join(root, "tsconfig.json");
const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
const { options } = ts.parseJsonConfigFileContent(config, ts.sys, root);
const GENERATED_SPECIFIER = /(^@\/generated\/|\/src\/generated\/|^\.{1,2}\/(?:\.\.\/)*generated\/)/;
const GENERATED_DIR = `${path.sep}src${path.sep}generated${path.sep}`;

/** Each import chain from `entry` that ends in a src/generated file. */
function generatedChains(entry: string): string[][] {
  const start = path.join(root, entry);
  const parent = new Map<string, string | null>([[start, null]]);
  const queue = [start];
  const chains: string[][] = [];
  const chainTo = (file: string, last: string) => {
    const chain = [last];
    for (let at: string | null = file; at; at = parent.get(at) ?? null) chain.unshift(path.relative(root, at));
    return chain;
  };
  while (queue.length > 0) {
    const file = queue.shift()!;
    const { importedFiles } = ts.preProcessFile(readFileSync(file, "utf8"), true, true);
    for (const { fileName: specifier } of importedFiles) {
      const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
      const target = resolved?.resolvedFileName;
      if ((target && target.includes(GENERATED_DIR)) || (!target && GENERATED_SPECIFIER.test(specifier))) {
        chains.push(chainTo(file, target ? path.relative(root, target) : specifier));
        continue;
      }
      if (!target || resolved.isExternalLibraryImport || target.endsWith(".d.ts") || parent.has(target)) continue;
      parent.set(target, file);
      queue.push(target);
    }
  }
  return chains;
}

for (const entry of ["scripts/generate-source-json.ts", "scripts/lib/source-json-payloads.ts"]) {
  const chains = generatedChains(entry);
  assert.deepEqual(
    chains.map((chain) => chain.join(" -> ")),
    [],
    `${entry} must not import src/generated or a module that reads it`,
  );
}

// The walker still sees the known stage-2 path, so a passing check means something.
assert.ok(
  generatedChains("scripts/generate-static-api-data.ts").some((chain) =>
    chain.includes("src/lib/place-registry.ts")),
  "walker lost the stage-2 path through place-registry",
);

console.log("source-json-imports.spec.ts: ok");

import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const imageRoot = path.join(repoRoot, "public/images/sts2");
const outputPath = path.join(repoRoot, "data/sts2/public-image-files.json");

async function walk(dir, relativeDir = "") {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const fullPath = path.join(dir, entry.name);
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      files.push(...await walk(fullPath, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

const files = await walk(imageRoot);
const index = {};

for (const file of files) {
  const dir = path.dirname(file);
  const filename = path.basename(file);
  index[dir] ??= [];
  index[dir].push(filename);
}

const sortedIndex = Object.fromEntries(
  Object.entries(index).sort(([a], [b]) => a.localeCompare(b)),
);

await fs.writeFile(outputPath, `${JSON.stringify(sortedIndex, null, 2)}\n`);
console.log(`Wrote ${path.relative(repoRoot, outputPath)} with ${files.length} files.`);

import fs from "fs/promises";

const memo = new Map<string, Promise<unknown>>();

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/**
 * Reads and parses a JSON data file. Builds that render many pages in one process set
 * JSON_FILE_MEMO=1 (the patch Worker renders 840 pages that each load the same catalogs):
 * then each file is parsed once and frozen, so a caller that changes it fails loudly instead
 * of changing what the next page reads. The dev server never memoizes, so data edits show.
 */
export function readJsonFile<T>(filePath: string, transform: (raw: string) => string = (raw) => raw): Promise<T> {
  return memoInBuild(`${filePath}\0${transform.name}`, () =>
    fs.readFile(filePath, "utf-8").then((raw) => JSON.parse(transform(raw)) as T));
}

/** `load()` once per key under JSON_FILE_MEMO=1 (frozen, as above); every call otherwise. */
export function memoInBuild<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (process.env.JSON_FILE_MEMO !== "1") return load();
  if (!memo.has(key)) memo.set(key, load().then(deepFreeze));
  return memo.get(key) as Promise<T>;
}

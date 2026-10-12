import type { CoverSpec } from "@/lib/run-cover-types";

/**
 * Share-on-upload inserts the auto cover, then the index used to refresh
 * before that insert finished. The card's share control stayed on the
 * unshared action, so a cover save skipped the remote write. A later share
 * click hit the unique row and also left cover_spec untouched. The owner's
 * IndexedDB copy showed the edit; every other device kept the auto cover.
 */

export function coverSpecsEqual(a: CoverSpec, b: CoverSpec): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Manual covers edited after the share payload was captured must replace
 * the auto cover on the donated row. Auto covers must not overwrite a row
 * that may already store a manual cover (re-upload generates a new one).
 */
export function coverToPublishAfterShare(
  sent: CoverSpec | null | undefined,
  latest: CoverSpec | null | undefined,
): CoverSpec | null {
  if (!latest || latest.auto !== false) return null;
  if (sent && coverSpecsEqual(sent, latest)) return null;
  return latest;
}

/** Unique-conflict shares publish a manual cover. Auto covers stay put. */
export function duplicateShareShouldUpdateCover(
  coverSpec: CoverSpec | null | undefined,
): coverSpec is CoverSpec & { auto: false } {
  return coverSpec?.auto === false;
}

/**
 * Local cover saves always attempt the donated-row update when storage
 * is on. Gating on the index "shared" flag drops the edit whenever that
 * flag is stale, which is how this bug comes back.
 */
export function localCoverSaveAttemptsRemoteSync(storageEnabled: boolean): boolean {
  return storageEnabled;
}

/**
 * Optimistic ids from a share that just succeeded must survive a donated-id
 * fetch that started too early or failed empty. An explicit unshare
 * (`dismissed`) wins over both the server snapshot and the optimistic id.
 */
export function unionDonatedIds(
  server: ReadonlySet<string>,
  optimistic: readonly string[],
  dismissed: ReadonlySet<string>,
): Set<string> {
  const next = new Set(server);
  for (const id of optimistic) next.add(id);
  for (const id of dismissed) next.delete(id);
  return next;
}

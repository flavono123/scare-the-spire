export function buildPatchCommentThreadKey(version: string): string {
  return `sts2-patch:${version}`;
}

export function buildCodexCommentThreadKey(entityType: string, entityId: string): string {
  return `sts2-codex:${entityType}:${entityId}`;
}

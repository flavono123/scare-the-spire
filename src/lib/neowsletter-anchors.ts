/**
 * A Neowsletter section id is unique on that page, so the hash is the id
 * itself. Patch lines keep a `patch-line-` prefix because their ids contain
 * colons and are shared with comments.
 *
 *   /patches/neowsletters/2026-08#roadmap
 */

export function neowsletterClaimAnchorId(claimId: string): string {
  return claimId;
}

export function neowsletterIssuePath(issueId: string): string {
  return `/patches/neowsletters/${issueId}`;
}

export function neowsletterClaimHref(issueId: string, claimId: string): string {
  return `${neowsletterIssuePath(issueId)}#${neowsletterClaimAnchorId(claimId)}`;
}

export function neowsletterLineKind(line: string): "heading" | "body" | "skip" {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("<!--")) return "skip";
  if (/^#{1,6}\s/.test(trimmed)) return "heading";
  if (/^\[(?:devnote|monster-pattern-diff|character-low-hp-idle)/.test(trimmed)) return "skip";
  return "body";
}

export function neowsletterBodyLines(markdown: string): string[] {
  return markdown.split("\n").filter((line) => neowsletterLineKind(line) === "body");
}

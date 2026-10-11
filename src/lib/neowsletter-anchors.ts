/**
 * Neowsletter permalinks. A claim is the section. Body lines inside it are
 * numbered in source order, skipping headings and blank lines, the same way
 * a patch line keeps one anchor per bullet.
 *
 *   /patches/neowsletters/2026-08#claim-ascension-10
 *   /patches/neowsletters/2026-08#claim-ascension-10-line-2
 */

export function neowsletterClaimAnchorId(claimId: string): string {
  return `claim-${claimId}`;
}

export function neowsletterLineAnchorId(claimId: string, lineNumber: number): string {
  return `${neowsletterClaimAnchorId(claimId)}-line-${lineNumber}`;
}

export function neowsletterIssuePath(issueId: string): string {
  return `/patches/neowsletters/${issueId}`;
}

export function neowsletterClaimHref(issueId: string, claimId: string): string {
  return `${neowsletterIssuePath(issueId)}#${neowsletterClaimAnchorId(claimId)}`;
}

export function neowsletterLineHref(issueId: string, claimId: string, lineNumber: number): string {
  return `${neowsletterIssuePath(issueId)}#${neowsletterLineAnchorId(claimId, lineNumber)}`;
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

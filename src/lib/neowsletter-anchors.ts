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

export function neowsletterHeadingText(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/\[(?:gold|blue|red|green|aqua|orange|pink|purple|silver)(?::[^\]]+)?]/g, "")
    .replace(/\[\/(?:gold|blue|red|green|aqua|orange|pink|purple|silver)]/g, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type NeowsletterClaimLike = { id: string; markdown: string };

/**
 * The claim marker owns the heading that follows it. A heading written after
 * body text belongs to the previous claim, so its permalink would name the
 * wrong section — the same shift patch-line ordinals had when a bullet moved.
 * The marker has to sit on the line before that heading. See
 * `scripts/neowsletter-anchors.spec.ts`.
 */
export function neowsletterOpeningHeading(markdown: string): string {
  for (const line of markdown.split("\n")) {
    const kind = neowsletterLineKind(line);
    if (kind === "skip") continue;
    if (kind === "heading") return neowsletterHeadingText(line);
    return "";
  }
  return "";
}

export function neowsletterHeadingFollowsBody(markdown: string): boolean {
  let seenBody = false;
  for (const line of markdown.split("\n")) {
    const kind = neowsletterLineKind(line);
    if (kind === "heading" && seenBody) return true;
    if (kind === "body") seenBody = true;
  }
  return false;
}

/** One id for the opening heading. Empty when this claim has no section title. */
export function neowsletterClaimHeadingAnchorIds(
  claims: readonly NeowsletterClaimLike[],
  index: number,
): string[] {
  const claim = claims[index];
  if (!claim || !neowsletterOpeningHeading(claim.markdown)) return [];
  return [claim.id];
}

export function neowsletterClaimWrapperAnchorId(
  claims: readonly NeowsletterClaimLike[],
  index: number,
): string | undefined {
  const claim = claims[index];
  if (!claim || neowsletterOpeningHeading(claim.markdown)) return undefined;
  return claim.id;
}

export function neowsletterSectionHeading(claims: readonly NeowsletterClaimLike[], index: number): string {
  return neowsletterOpeningHeading(claims[index]?.markdown ?? "");
}

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

export type NeowsletterHeadingRole = "opening" | "handoff" | "nested";

/**
 * A heading at the start of a claim titles that claim. The last heading that
 * follows body text titles the next claim when that claim has no heading of
 * its own. September 2026 parks "첨탑 관측" and "지도 걸작선" this way.
 */
export function neowsletterHeadingRoles(markdown: string): Array<{ text: string; role: NeowsletterHeadingRole }> {
  const drafts: Array<{ text: string; bodyBefore: boolean }> = [];
  let seenBody = false;
  for (const line of markdown.split("\n")) {
    const kind = neowsletterLineKind(line);
    if (kind === "heading") {
      drafts.push({ text: neowsletterHeadingText(line), bodyBefore: seenBody });
      continue;
    }
    if (kind === "body") seenBody = true;
  }
  const handoffAt = drafts.findLastIndex((draft) => draft.bodyBefore);
  return drafts.map((draft, index) => ({
    text: draft.text,
    role: !draft.bodyBefore ? "opening" : index === handoffAt ? "handoff" : "nested",
  }));
}

type NeowsletterClaimLike = { id: string; markdown: string };

function nextClaimWithoutOpeningHeading(claims: readonly NeowsletterClaimLike[], index: number): string | undefined {
  const next = claims[index + 1];
  if (!next) return undefined;
  if (neowsletterHeadingRoles(next.markdown).some((heading) => heading.role === "opening")) return undefined;
  return next.id;
}

/** One id per heading, in order. Empty string means the heading is not a permalink. */
export function neowsletterClaimHeadingAnchorIds(
  claims: readonly NeowsletterClaimLike[],
  index: number,
): string[] {
  const target = nextClaimWithoutOpeningHeading(claims, index);
  return neowsletterHeadingRoles(claims[index]?.markdown ?? "").map((heading) => {
    if (heading.role === "opening") return claims[index]?.id ?? "";
    if (heading.role === "handoff" && target) return target;
    return "";
  });
}

export function neowsletterClaimWrapperAnchorId(
  claims: readonly NeowsletterClaimLike[],
  index: number,
): string | undefined {
  const claim = claims[index];
  if (!claim) return undefined;
  if (neowsletterHeadingRoles(claim.markdown).some((heading) => heading.role === "opening")) return undefined;
  if (index > 0 && neowsletterClaimHeadingAnchorIds(claims, index - 1).includes(claim.id)) return undefined;
  return claim.id;
}

/** Visible section title for a claim, including a heading parked on the previous claim. */
export function neowsletterSectionHeading(claims: readonly NeowsletterClaimLike[], index: number): string {
  const opening = neowsletterHeadingRoles(claims[index]?.markdown ?? "").find((heading) => heading.role === "opening");
  if (opening?.text) return opening.text;
  if (index <= 0) return "";
  const handoff = [...neowsletterHeadingRoles(claims[index - 1]?.markdown ?? "")].reverse().find((heading) => heading.role === "handoff");
  return handoff?.text ?? "";
}

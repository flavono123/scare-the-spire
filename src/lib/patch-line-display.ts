import type { ServiceLocale } from "@/lib/i18n";
import type { STS2PatchLine } from "@/lib/types";

const PATCH_CHANGE_TAG_RE = /\(([^)\n]*(?:\bbuff\b|\bnerf\b)[^)\n]*)\)(?=:)/gi;

export function withPatchChangeEffects(markdown: string): string {
  return markdown.replace(PATCH_CHANGE_TAG_RE, (_match, inner: string) => {
    const tagged = inner
      .replace(/\bbuff\b/gi, (value) => `[green][sine]${value}[/sine][/green]`)
      .replace(/\bnerf\b/gi, (value) => `[red][jitter]${value}[/jitter][/red]`);
    return `(${tagged})`;
  });
}

export function patchLineMarkdownForService(
  patchLine: STS2PatchLine,
  serviceLocale: ServiceLocale | undefined,
): string {
  return serviceLocale === "ko"
    ? patchLine.markdownKo || patchLine.markdownEn || ""
    : patchLine.markdownEn || patchLine.markdownKo || "";
}

export function patchLineDisplayText(patchLine: STS2PatchLine, serviceLocale: ServiceLocale): string {
  return serviceLocale === "ko"
    ? patchLine.textKo || patchLine.textEn || ""
    : patchLine.textEn || patchLine.textKo || "";
}

export function patchLineRichText(patchLine: STS2PatchLine, serviceLocale: ServiceLocale): string {
  return withPatchChangeEffects(patchLineMarkdownForService(patchLine, serviceLocale))
    .replace(/\*\*([^*\n]+)\*\*/g, "[gold]$1[/gold]");
}

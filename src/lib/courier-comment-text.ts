import { emotePlainText } from "@/lib/emote-con";

/**
 * One-line courier preview of a stored comment.
 *
 * `content` keeps card-con / text-con / emote-con markers and keyword
 * lookup braces (`label{keyword}`). Stripping every `[...]` drops a
 * comment that is only those markers, so an older plain comment becomes
 * the first courier line.
 *
 * Keep the patch Worker's copy in `patch-comments-client.js` aligned.
 */
export function courierCommentText(content: string): string {
  return content
    .replace(/\[카드콘:([^\]]*)\]/g, "$1")
    .replace(/\[글자콘:([^\]]*)\]/g, "$1")
    .replace(/\[감정콘:([^\]]*)\]/g, (_match, id: string) => {
      const label = emotePlainText(id);
      return label ? ` ${label} ` : " ";
    })
    .replace(/\{[^{}]+\}/g, "")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

import type { ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

export type CodexServiceMessages =
  (typeof serviceMessages)[ServiceLocale]["codex"];

export function getCodexServiceMessages(
  serviceLocale: ServiceLocale,
): CodexServiceMessages {
  return serviceMessages[serviceLocale].codex;
}

export function formatCodexCount(
  count: number,
  unit: string,
  serviceLocale: ServiceLocale,
): string {
  if (serviceLocale === "ko") return `${count}${unit}`;

  const displayUnit = count === 1 ? unit.replace(/s$/, "") : unit;
  return `${count} ${displayUnit}`;
}

export function formatTemplateCount(template: string, count: number): string {
  return template.replace("{count}", String(count));
}

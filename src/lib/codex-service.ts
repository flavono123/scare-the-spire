import type { ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

type CodexMetadata = {
  title: {
    absolute: string;
  };
  description: string;
};

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

  const singularOverrides: Record<string, string> = {
    entries: "entry",
  };
  const displayUnit = count === 1
    ? singularOverrides[unit] ?? unit.replace(/s$/, "")
    : unit;
  return `${count} ${displayUnit}`;
}

export function formatTemplateCount(template: string, count: number): string {
  return template.replace("{count}", String(count));
}

export function getCodexMetadata(
  serviceLocale: ServiceLocale,
  title: string,
): CodexMetadata {
  const messages = serviceMessages[serviceLocale];
  return {
    title: {
      absolute: `${title} — ${messages.brand}`,
    },
    description: serviceLocale === "ko"
      ? `슬레이 더 스파이어 2 ${title}`
      : `Slay the Spire 2 ${title}.`,
  };
}

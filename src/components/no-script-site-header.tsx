import type { ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

function HeaderLinks({ serviceLocale }: { serviceLocale: ServiceLocale }) {
  const messages = serviceMessages[serviceLocale];
  const prefix = serviceLocale === "ko" ? "" : "/en";
  const links = [
    [`${prefix}/patches`, messages.nav.patches],
    [`${prefix}/compendium`, messages.games.sts2Codex],
    [`${prefix}/c-c-c-combo`, messages.nav.combo],
    [`${prefix}/this-or-that`, messages.nav.thisOrThat],
    [`${prefix}/history-course`, messages.nav.historyCourse],
  ] as const;

  return (
    <div
      data-service-locale-only={serviceLocale}
      className="flex h-12 items-center gap-4 overflow-x-auto whitespace-nowrap px-4 text-sm"
    >
      <a href={prefix || "/"} className="font-bold text-primary">{messages.brand}</a>
      {links.map(([href, label]) => (
        <a key={href} href={href} className="text-muted-foreground hover:text-foreground">
          {label}
        </a>
      ))}
    </div>
  );
}

/**
 * The real navbar reads the query string, so static pages render it only in
 * the browser. Without JavaScript this takes its place. Pages under a game
 * locale get the English links: the shared layout cannot know the locale.
 */
export function NoScriptSiteHeader() {
  return (
    <noscript>
      <header className="sticky top-0 z-50 border-b border-border bg-background/90">
        <HeaderLinks serviceLocale="ko" />
        <HeaderLinks serviceLocale="en" />
      </header>
    </noscript>
  );
}

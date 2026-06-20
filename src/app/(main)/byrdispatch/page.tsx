import type { Metadata } from "next";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { PatchNoteRenderer, type EntityInfo } from "@/components/patch-note-renderer";
import Image from "@/components/ui/static-image";
import {
  getServiceLocaleForGameLocale,
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { buildByrdispatchCommentThreadKey } from "@/lib/comment-threads";
import { getCodexGameUiLabels, type CodexGameUiLabels } from "@/lib/codex-game-ui";
import { loadAllEntities } from "@/lib/load-all-entities";
import {
  getShaNewsEntries,
  SHA_NEWS_ICON,
  SHA_NEWS_NOTICE_ICON,
  type ShaNewsBullet,
  type ShaNewsSection,
  type ShaNewsStatus,
} from "@/lib/sha-news";
import {
  isByrdispatchMigrationNoticeText,
  isConfiguredByrdispatchMigrationTargetHost,
} from "@/lib/sha-news-static";
import { serviceMessages } from "@/messages/service";

export function generateShaNewsMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Metadata {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  return serviceMessages[serviceLocale].shaNews.metadata;
}

export function generateMetadata(): Metadata {
  return generateShaNewsMetadata();
}

const STATUS_TOKEN_ASSETS: Record<ShaNewsStatus, { src: string }> = {
  new: { src: "/images/sts2/relics/new_leaf.webp" },
  wip: { src: "/images/sts2/powers/hammer_time_power.webp" },
  bug: { src: "/images/sts2/powers/infested_power.webp" },
};

type ShaNewsStatusLabels = Readonly<Record<ShaNewsStatus, string>>;

const SERVICE_ICONS: Record<string, { href: string | null; icon: string }> = {
  "섀 소식": { href: "/byrdispatch", icon: SHA_NEWS_ICON },
  백과사전: { href: null, icon: "/images/sts2/icons/app_icon.png" },
  캐릭터: { href: "/compendium/characters", icon: "/images/sts2/characters/character_icon_ironclad.webp" },
  카드: { href: "/compendium/cards", icon: "/images/sts2/nav/stats_cards.png" },
  키워드: { href: "/compendium/keywords", icon: "/images/sts2/ui/topbar/submenu_history_icon.png" },
  유물: { href: "/compendium/relics", icon: "/images/sts2/relics/bing_bong.webp" },
  포션: { href: "/compendium/potions", icon: "/images/sts2/potions/potion_shaped_rock.webp" },
  파워: { href: "/compendium/powers", icon: "/images/sts2/nav/unmovable_power_beta.webp" },
  인챈트: { href: "/compendium/enchantments", icon: "/images/sts2/enchantments/souls_power.webp" },
  몬스터: { href: "/compendium/bestiary", icon: "/images/sts2/nav/happy_cultist.png" },
  이벤트: { href: "/compendium/events", icon: "/images/sts2/nav/question_mark.png" },
  "고대의 존재": { href: "/compendium/ancients", icon: "/images/sts2/nav/stats_ancients.png" },
  연대기: { href: "/compendium/epochs", icon: "/images/sts2/relics/planisphere.webp" },
  "역사 강의서": { href: "/history-course", icon: "/images/sts2/relics/history_course.webp" },
};

function normalizeServiceTitle(title: string): string {
  return title
    .replace(/\s*\((?:베타|beta)\)\s*/gi, "")
    .trim();
}

function serviceIconFor(title: string) {
  return SERVICE_ICONS[normalizeServiceTitle(title)] ?? null;
}

function TokenIcon({
  src,
  label,
  className = "h-5 w-5",
}: {
  src: string;
  label: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={label}
      title={label}
      width={20}
      height={20}
      className={`inline-block shrink-0 object-contain align-[-0.25em] drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] ${className}`}
    />
  );
}

function StatusTokenIcon({
  src,
  label,
}: {
  src: string;
  label: string;
}) {
  return (
    <span
      aria-label={label}
      data-tooltip={label}
      tabIndex={0}
      className="byrdispatch-status-token h-5 w-5"
    >
      <Image
        src={src}
        alt=""
        width={20}
        height={20}
        className="h-full w-full object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
      />
    </span>
  );
}

function StatusTokens({
  statuses,
  labels,
}: {
  statuses: ShaNewsStatus[];
  labels: ShaNewsStatusLabels;
}) {
  if (statuses.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {statuses.map((status) => (
        <StatusTokenIcon
          key={status}
          src={STATUS_TOKEN_ASSETS[status].src}
          label={labels[status]}
        />
      ))}
    </span>
  );
}

function ServiceHeading({
  section,
  serviceLocale,
  gameLocale,
  statusLabels,
}: {
  section: ShaNewsSection;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  statusLabels: ShaNewsStatusLabels;
}) {
  const isChild = section.level === 3;
  const service = serviceIconFor(section.title);
  const headingClassName = section.isNotice
    ? "mt-0 flex items-center gap-2 text-lg font-black"
    : isChild
      ? "mt-4 flex items-center gap-2 text-base font-black"
      : "mt-6 flex items-center gap-2 text-lg font-black";
  const canLink = Boolean(service?.href) && !section.isNotice;
  const titleClassName = section.isNotice
    ? "text-pink-100"
    : canLink
      ? "text-cyan-200 transition-colors hover:text-cyan-100"
      : "text-cyan-200";
  const content = (
    <>
      <TokenIcon
        src={section.isNotice ? SHA_NEWS_NOTICE_ICON : service?.icon ?? SHA_NEWS_ICON}
        label={section.title}
        className={isChild ? "h-5 w-5" : "h-6 w-6"}
      />
      {canLink && service?.href ? (
        <Link
          href={localizeHrefWithGameLocale(service.href, serviceLocale, gameLocale)}
          className={titleClassName}
        >
          {section.title}
        </Link>
      ) : (
        <span className={titleClassName}>{section.title}</span>
      )}
      <StatusTokens statuses={section.statuses} labels={statusLabels} />
    </>
  );

  if (isChild) {
    return <h3 className={headingClassName}>{content}</h3>;
  }

  return <h2 className={headingClassName}>{content}</h2>;
}

function ShaNewsBulletLine({
  bullet,
  notice,
  entities,
  gameUi,
  serviceLocale,
  gameLocale,
  statusLabels,
}: {
  bullet: ShaNewsBullet;
  notice: boolean;
  entities: EntityInfo[];
  gameUi: CodexGameUiLabels;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  statusLabels: ShaNewsStatusLabels;
}) {
  return (
    <li className="flex gap-2">
      <span
        aria-hidden
        className={
          notice
            ? "mt-2 h-1.5 w-1.5 shrink-0 bg-pink-200"
            : "mt-2 h-1.5 w-1.5 shrink-0 bg-purple-200/80"
        }
      />
      <div
        className={[
          "min-w-0 flex-1 text-sm leading-6",
          "[&_.patch-note-content]:inline [&_.patch-note-content>p]:inline",
          notice
            ? "[&_.patch-note-content>p]:mb-0 [&_.patch-note-content>p]:text-pink-100"
            : "[&_.patch-note-content>p]:mb-0 [&_.patch-note-content>p]:text-zinc-300",
        ].join(" ")}
      >
        <PatchNoteRenderer
          markdown={bullet.text}
          entities={entities}
          gameUi={gameUi}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
          preferEntityLocaleLabel
          epochArtMode="beta"
        />
        <StatusTokens statuses={bullet.statuses} labels={statusLabels} />
      </div>
    </li>
  );
}

function ShaNewsSectionList({
  sections,
  notice = false,
  entities,
  gameUi,
  serviceLocale,
  gameLocale,
  statusLabels,
}: {
  sections: ShaNewsSection[];
  notice?: boolean;
  entities: EntityInfo[];
  gameUi: CodexGameUiLabels;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  statusLabels: ShaNewsStatusLabels;
}) {
  if (sections.length === 0) return null;

  return (
    <div className={notice ? "space-y-3" : "space-y-4"}>
      {sections.map((section) => (
        <section
          key={section.title}
          className={
            notice
              ? "border border-pink-300/35 bg-pink-500/10 px-4 pb-3 pt-0 shadow-[0_0_22px_rgba(244,114,182,0.08)]"
              : section.level === 3
                ? "pl-5"
                : undefined
          }
        >
          <ServiceHeading
            section={section}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
            statusLabels={statusLabels}
          />
          {section.bullets.length > 0 && (
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-zinc-300">
              {section.bullets.map((bullet) => (
                <ShaNewsBulletLine
                  key={bullet.text}
                  bullet={bullet}
                  notice={notice}
                  entities={entities}
                  gameUi={gameUi}
                  serviceLocale={serviceLocale}
                  gameLocale={gameLocale}
                  statusLabels={statusLabels}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function isMigrationNoticeSection(section: ShaNewsSection): boolean {
  return section.bullets.some((bullet) => isByrdispatchMigrationNoticeText(bullet.text));
}

export async function renderShaNewsPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const messages = serviceMessages[serviceLocale].shaNews;
  const statusLabels = messages.status;
  const commonMessages = serviceMessages[serviceLocale].codex.common;
  const hideMigrationNotice = isConfiguredByrdispatchMigrationTargetHost();
  const [entries, entities, gameUi] = await Promise.all([
    getShaNewsEntries(),
    loadAllEntities({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 text-foreground sm:py-10">
      <header className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-purple-200/35 bg-purple-500/10">
          <Image
            src={SHA_NEWS_ICON}
            alt=""
            width={42}
            height={42}
            className="h-[42px] w-[42px] object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.55)]"
            priority
          />
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight text-zinc-50">
            {messages.title}
          </h1>
        </div>
      </header>

      {entries.length > 0 && (
        <div className="mt-8 space-y-8">
          {entries.map((entry) => {
            const noticeSections = hideMigrationNotice
              ? entry.noticeSections.filter((section) => !isMigrationNoticeSection(section))
              : entry.noticeSections;

            return (
              <article
                key={entry.date}
                className="border-t border-border/70 pt-6 first:border-t-0 first:pt-0"
              >
                <time className="text-sm font-black text-zinc-500" dateTime={entry.date}>
                  {entry.date}
                </time>
                {noticeSections.length > 0 && (
                  <div className="mt-4">
                    <ShaNewsSectionList
                      sections={noticeSections}
                      notice
                      entities={entities}
                      gameUi={gameUi}
                      serviceLocale={serviceLocale}
                      gameLocale={gameLocale}
                      statusLabels={statusLabels}
                    />
                  </div>
                )}
                {entry.regularSections.length > 0 && (
                  <div className={noticeSections.length > 0 ? "mt-5" : "mt-4"}>
                    <ShaNewsSectionList
                      sections={entry.regularSections}
                      entities={entities}
                      gameUi={gameUi}
                      serviceLocale={serviceLocale}
                      gameLocale={gameLocale}
                      statusLabels={statusLabels}
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <section className="mt-8 border-t border-border/70 pt-6">
        <h2 className="mb-3 text-sm font-bold text-zinc-100">
          {commonMessages.comments}
        </h2>
        <CommentSection
          threadKey={buildByrdispatchCommentThreadKey()}
          initialEntities={entities}
        />
      </section>
    </main>
  );
}

export default async function ShaNewsPage() {
  return renderShaNewsPage();
}

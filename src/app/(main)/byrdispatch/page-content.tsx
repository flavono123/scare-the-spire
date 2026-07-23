import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { CommentSection } from "@/components/comment-section";
import { ByrdispatchProfileIcon } from "@/components/byrdispatch-profile-icon";
import { ByrdispatchStoryComposerButton } from "@/components/byrdispatch-story-composer-button";
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
import { getStoryComposerPlaceholder } from "@/lib/sts2-game-ui-copy";
import {
  getByrdispatchEntries,
  BYRDISPATCH_ICON,
  BYRDISPATCH_NOTICE_ICON,
  type ByrdispatchBullet,
  type ByrdispatchMedia,
  type ByrdispatchSection,
  type ByrdispatchSectionItem,
  type ByrdispatchStatus,
} from "@/lib/byrdispatch";
import {
  isByrdispatchMigrationNoticeText,
  isConfiguredByrdispatchMigrationTargetHost,
} from "@/lib/byrdispatch-static";
import { serviceMessages } from "@/messages/service";

export function generateByrdispatchMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Metadata {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  return serviceMessages[serviceLocale].byrdispatch.metadata;
}

const STATUS_TOKEN_ASSETS: Record<ByrdispatchStatus, { src: string }> = {
  new: { src: "/images/sts2/relics/new_leaf.webp" },
  wip: { src: "/images/sts2/powers/hammer_time_power.webp" },
  bug: { src: "/images/sts2/powers/infested_power.webp" },
  reportThanks: { src: "/images/sts2/relics/wongo_customer_appreciation_badge.webp" },
};

type ByrdispatchStatusLabels = Readonly<Record<ByrdispatchStatus, string>>;

const SERVICE_ICONS: Record<string, { href: string | null; icon: string }> = {
  "공통": { href: null, icon: BYRDISPATCH_ICON },
  "슬서운 이야기": { href: "/", icon: "/images/sts2/relics/bone_tea.webp" },
  "섀소식": { href: "/byrdispatch", icon: BYRDISPATCH_ICON },
  "패치노트": { href: "/patches", icon: "/images/sts2/nav/patch_notes_icon.png" },
  "패치 노트": { href: "/patches", icon: "/images/sts2/nav/patch_notes_icon.png" },
  백과사전: { href: null, icon: "/images/sts2/icons/app_icon.png" },
  캐릭터: { href: "/compendium/characters", icon: "/images/sts2/characters/character_icon_ironclad.webp" },
  카드: { href: "/compendium/cards", icon: "/images/sts2/nav/stats_cards.png" },
  "카드 모음집": { href: "/compendium/cards", icon: "/images/sts2/nav/stats_cards.png" },
  키워드: { href: "/compendium/keywords", icon: "/images/sts2/ui/topbar/submenu_history_icon.png" },
  유물: { href: "/compendium/relics", icon: "/images/sts2/relics/bing_bong.webp" },
  포션: { href: "/compendium/potions", icon: "/images/sts2/potions/potion_shaped_rock.webp" },
  파워: { href: "/compendium/powers", icon: "/images/sts2/nav/unmovable_power_beta.webp" },
  인챈트: { href: "/compendium/enchantments", icon: "/images/sts2/enchantments/souls_power.webp" },
  몬스터: { href: "/compendium/bestiary", icon: "/images/sts2/nav/happy_cultist.png" },
  전투: { href: "/compendium/encounters", icon: "/images/sts2/nav/stats_monsters.png" },
  이벤트: { href: "/compendium/events", icon: "/images/sts2/nav/question_mark.png" },
  "고대의 존재": { href: "/compendium/ancients", icon: "/images/sts2/nav/stats_ancients.png" },
  연대기: { href: "/compendium/epochs", icon: "/images/sts2/relics/planisphere.webp" },
  "코오오옴보": { href: "/c-c-c-combo", icon: "/images/sts2/badges/ccccombo.webp" },
  "케미컬X": { href: "/chemical-x", icon: "/images/sts2/relics/chemical_x.webp" },
  "케미컬엑스": { href: "/chemical-x", icon: "/images/sts2/relics/chemical_x.webp" },
  "역사 강의서": { href: "/history-course", icon: "/images/sts2/relics/history_course.webp" },
  "이거 아님 저거?": { href: "/this-or-that", icon: "/images/sts2/relics/choices_paradox.webp" },
  "프로필": { href: "/profile", icon: "/images/sts2/characters/character_icon_random_character_outline.webp" },
  "댓글": { href: null, icon: "/images/sts2/relics/storybook.webp" },
  "개발/운영": { href: null, icon: "/images/sts2/relics/toolbox.webp" },
};

const SERVICE_REFERENCE_LINKS: Record<string, string> = {
  패치노트: "/patches",
  "패치 노트": "/patches",
  "슬서운 이야기": "/",
  섀소식: "/byrdispatch",
  백과사전: "/compendium",
  "역사 강의서": "/history-course",
  "이거 아님 저거?": "/this-or-that",
  "코오오옴보": "/c-c-c-combo",
  "케미컬X": "/chemical-x",
  "케미컬엑스": "/chemical-x",
  "프로필": "/profile",
};

const SERVICE_REFERENCE_RE = /(이거 아님 저거\?|역사 강의서|슬서운 이야기|패치노트|패치 노트|코오오옴보|케미컬X|케미컬엑스|백과사전|섀소식|프로필)/g;
const STORY_COMPOSER_ACTION_TOKEN = "[새 이야기 쓰기 버튼 노출/링크]";
const INLINE_ACTION_RE = new RegExp(`${STORY_COMPOSER_ACTION_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${SERVICE_REFERENCE_RE.source}`, "g");

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
  statuses: ByrdispatchStatus[];
  labels: ByrdispatchStatusLabels;
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
  section: ByrdispatchSection;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  statusLabels: ByrdispatchStatusLabels;
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
      {normalizeServiceTitle(section.title) === "프로필" ? (
        <ByrdispatchProfileIcon className={isChild ? "h-5 w-5" : "h-6 w-6"} />
      ) : (
        <TokenIcon
          src={section.isNotice ? BYRDISPATCH_NOTICE_ICON : service?.icon ?? BYRDISPATCH_ICON}
          label={section.title}
          className={isChild ? "h-5 w-5" : "h-6 w-6"}
        />
      )}
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

function ByrdispatchRichText({
  text,
  entities,
  gameUi,
  serviceLocale,
  gameLocale,
  storyPlaceholder,
}: {
  text: string;
  entities: EntityInfo[];
  gameUi: CodexGameUiLabels;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  storyPlaceholder: string;
}) {
  const renderTextSegment = (segment: string, key: string) => {
    const leadingWhitespace = segment.match(/^\s+/)?.[0] ?? "";
    const content = segment.slice(leadingWhitespace.length);
    if (!content) return leadingWhitespace;

    return (
      <Fragment key={key}>
        {leadingWhitespace}
        <PatchNoteRenderer
          markdown={content}
          entities={entities}
          gameUi={gameUi}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
          preferEntityLocaleLabel
          epochArtMode="beta"
        />
      </Fragment>
    );
  };
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = 0;

  for (const match of text.matchAll(INLINE_ACTION_RE)) {
    const index = match.index ?? 0;
    const isComposerAction = match[0] === STORY_COMPOSER_ACTION_TOKEN;
    const label = match[1];
    const href = SERVICE_REFERENCE_LINKS[label];
    const service = label ? serviceIconFor(label) : null;

    if (index > lastIndex) {
      parts.push(renderTextSegment(text.slice(lastIndex, index), `text-${matchIndex}`));
    }

    parts.push(isComposerAction ? (
      <ByrdispatchStoryComposerButton
        key={`story-composer-${matchIndex}`}
        serviceLocale={serviceLocale}
        storyPlaceholder={storyPlaceholder}
        entities={entities}
      />
    ) : href && service ? (
      <Link
        key={`service-${matchIndex}`}
        href={localizeHrefWithGameLocale(href, serviceLocale, gameLocale)}
        className="inline-flex items-center gap-1 align-[-0.2em] font-semibold text-cyan-200 transition-colors hover:text-cyan-100"
      >
        {label === "프로필" ? (
          <ByrdispatchProfileIcon className="inline-block h-4 w-4 shrink-0 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
        ) : (
          <Image
            src={service.icon}
            alt=""
            width={16}
            height={16}
            className="inline-block h-4 w-4 shrink-0 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
          />
        )}
        <span>{match[0]}</span>
      </Link>
    ) : match[0]);

    lastIndex = index + match[0].length;
    matchIndex += 1;
  }

  if (lastIndex === 0) {
    return (
      <PatchNoteRenderer
        markdown={text}
        entities={entities}
        gameUi={gameUi}
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
        preferEntityLocaleLabel
        epochArtMode="beta"
      />
    );
  }

  if (lastIndex < text.length) {
    parts.push(renderTextSegment(text.slice(lastIndex), "tail"));
  }

  return <span className="inline">{parts}</span>;
}

function ByrdispatchBulletLine({
  bullet,
  notice,
  entities,
  gameUi,
  serviceLocale,
  gameLocale,
  statusLabels,
  storyPlaceholder,
}: {
  bullet: ByrdispatchBullet;
  notice: boolean;
  entities: EntityInfo[];
  gameUi: CodexGameUiLabels;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  statusLabels: ByrdispatchStatusLabels;
  storyPlaceholder: string;
}) {
  const childBullet = bullet.depth > 0;
  return (
    <li className={["flex gap-2", childBullet ? "ml-5" : ""].filter(Boolean).join(" ")}>
      <span
        aria-hidden
        className={
          notice
            ? childBullet
              ? "mt-2.5 h-1 w-1 shrink-0 rounded-full border border-pink-200"
              : "mt-2 h-1.5 w-1.5 shrink-0 bg-pink-200"
            : childBullet
              ? "mt-2.5 h-1 w-1 shrink-0 rounded-full border border-purple-200/80"
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
        <ByrdispatchRichText
          text={bullet.text}
          entities={entities}
          gameUi={gameUi}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
          storyPlaceholder={storyPlaceholder}
        />
        <StatusTokens statuses={bullet.statuses} labels={statusLabels} />
      </div>
    </li>
  );
}

function ByrdispatchMediaBlock({ media }: { media: ByrdispatchMedia }) {
  const compact = media.src.includes("/story-reaction-palette.");
  return (
    <figure className={[
      "mt-3 overflow-hidden rounded-lg border border-border/70 bg-zinc-950/70",
      compact ? "mx-auto w-1/2" : "",
    ].filter(Boolean).join(" ")}
    >
      <Image
        src={media.src}
        alt={media.alt}
        title={media.title}
        width={1280}
        height={776}
        loading="lazy"
        className="w-full object-cover"
      />
      {media.alt && (
        <figcaption className="border-t border-border/60 px-3 py-2 text-xs font-medium text-zinc-400">
          {media.alt}
        </figcaption>
      )}
    </figure>
  );
}

function ByrdispatchSectionItemLine({
  item,
  notice,
  entities,
  gameUi,
  serviceLocale,
  gameLocale,
  statusLabels,
  storyPlaceholder,
}: {
  item: ByrdispatchSectionItem;
  notice: boolean;
  entities: EntityInfo[];
  gameUi: CodexGameUiLabels;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  statusLabels: ByrdispatchStatusLabels;
  storyPlaceholder: string;
}) {
  if (item.type === "image") {
    return (
      <li className="block">
        <ByrdispatchMediaBlock media={item.media} />
      </li>
    );
  }

  return (
    <ByrdispatchBulletLine
      bullet={item.bullet}
      notice={notice}
      entities={entities}
      gameUi={gameUi}
      serviceLocale={serviceLocale}
      gameLocale={gameLocale}
      statusLabels={statusLabels}
      storyPlaceholder={storyPlaceholder}
    />
  );
}

function ByrdispatchSectionList({
  sections,
  notice = false,
  entities,
  gameUi,
  serviceLocale,
  gameLocale,
  statusLabels,
  storyPlaceholder,
}: {
  sections: ByrdispatchSection[];
  notice?: boolean;
  entities: EntityInfo[];
  gameUi: CodexGameUiLabels;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  statusLabels: ByrdispatchStatusLabels;
  storyPlaceholder: string;
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
          {section.items.length > 0 && (
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-zinc-300">
              {section.items.map((item, index) => (
                <Fragment
                  key={item.type === "bullet" ? `bullet-${item.bullet.text}` : `image-${item.media.src}-${index}`}
                >
                  <ByrdispatchSectionItemLine
                    item={item}
                    notice={notice}
                    entities={entities}
                    gameUi={gameUi}
                    serviceLocale={serviceLocale}
                    gameLocale={gameLocale}
                    statusLabels={statusLabels}
                    storyPlaceholder={storyPlaceholder}
                  />
                </Fragment>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function isMigrationNoticeSection(section: ByrdispatchSection): boolean {
  return section.bullets.some((bullet) => isByrdispatchMigrationNoticeText(bullet.text));
}

export async function renderByrdispatchPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const messages = serviceMessages[serviceLocale].byrdispatch;
  const statusLabels = messages.status;
  const commonMessages = serviceMessages[serviceLocale].codex.common;
  const hideMigrationNotice = isConfiguredByrdispatchMigrationTargetHost();
  const [entries, entities, gameUi, storyPlaceholder] = await Promise.all([
    getByrdispatchEntries(),
    loadAllEntities({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
    getStoryComposerPlaceholder(gameLocale),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 text-foreground sm:py-10">
      <header className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-purple-200/35 bg-purple-500/10">
          <Image
            src={BYRDISPATCH_ICON}
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
                id={entry.date}
                tabIndex={-1}
                className="scroll-mt-20 border-t border-border/70 pt-6 outline-none first:border-t-0 first:pt-0 target:bg-purple-500/[0.04] target:ring-1 target:ring-purple-300/25"
              >
                <Link
                  href={`#${entry.date}`}
                  className="inline-flex text-sm font-black text-zinc-500 transition-colors hover:text-purple-200"
                  aria-label={`${entry.date} 섀소식 링크`}
                >
                  <time dateTime={entry.date}>{entry.date}</time>
                </Link>
                {noticeSections.length > 0 && (
                  <div className="mt-4">
                    <ByrdispatchSectionList
                      sections={noticeSections}
                      notice
                      entities={entities}
                      gameUi={gameUi}
                      serviceLocale={serviceLocale}
                      gameLocale={gameLocale}
                      statusLabels={statusLabels}
                      storyPlaceholder={storyPlaceholder}
                    />
                  </div>
                )}
                {entry.regularSections.length > 0 && (
                  <div className={noticeSections.length > 0 ? "mt-5" : "mt-4"}>
                    <ByrdispatchSectionList
                      sections={entry.regularSections}
                      entities={entities}
                      gameUi={gameUi}
                      serviceLocale={serviceLocale}
                      gameLocale={gameLocale}
                      statusLabels={statusLabels}
                      storyPlaceholder={storyPlaceholder}
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

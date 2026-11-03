"use client";

import { useRef, useState, type ReactNode } from "react";
import Image from "@/components/ui/static-image";
import { CompendiumAssetImageActions } from "@/components/codex/compendium-asset-image-actions";
import { MonsterAscensionStepper, useMonsterAscensionLevel } from "@/components/codex/monster-ascension";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1DetailShell, Sts1EnglishName, Sts1MetaPill } from "./detail-chrome";
import { Sts1MentionHover } from "./mention-hover";
import { Sts1MonsterStage, type Sts1MonsterPlayback } from "./monster-stage";
import type { ServiceLocale } from "@/lib/i18n";
import { STS1_MONSTER_TYPE_COLORS } from "@/lib/sts1/card-style";
import {
  STS1_MONSTER_ASCENSION_SCOPE,
  formatSts1Amount,
  hitPointsAt,
  sts1IntentDamageLabel,
  sts1IntentImageName,
  tierAt,
} from "@/lib/sts1/monster-moves";
import { sts1IndexPath, sts1IntentImageUrl, sts1PowerImageUrl, sts1UiImageUrl } from "@/lib/sts1/paths";
import type {
  Sts1Monster,
  Sts1MonsterEffects,
  Sts1MonsterHitPoints,
  Sts1MonsterMove,
  Sts1MonsterMoveTier,
  Sts1MonsterRefs,
  Sts1UiLabels,
} from "@/lib/sts1/types";

const NUMBER_SHADOW = "0 2px 0 #000, 0 0 4px #000, 1px 1px 0 #000";

function hitPointRange({ min, max }: Sts1MonsterHitPoints): string {
  return min === max ? String(min) : `${min}–${max}`;
}

function detailText(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? {
        base: "기본",
        moves: "행동",
        startingEffects: "시작 효과",
        ally: "아군",
        heal: "회복",
        summon: "소환",
        dies: "자멸",
        piles: { discard: "버린 카드 더미", draw: "뽑을 카드 더미", hand: "손", "discard-and-deck": "버린 카드 더미·덱" },
        noMoves: "행동 데이터 없음",
      }
    : {
        base: "Base",
        moves: "Moves",
        startingEffects: "Starting effects",
        ally: "Ally",
        heal: "Heal",
        summon: "Summon",
        dies: "Dies",
        piles: { discard: "discard pile", draw: "draw pile", hand: "hand", "discard-and-deck": "discard pile and deck" },
        noMoves: "No move data",
      };
}

type DetailText = ReturnType<typeof detailText>;

/** Code constants like `SKULL_BASH`, for moves the game leaves unnamed. */
function prettyKey(key: string | null): string | null {
  if (!key) return null;
  return key.toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function IntentToken({ tier, size }: { tier: Sts1MonsterMoveTier; size: "stage" | "chip" }) {
  const image = sts1IntentImageName(tier);
  if (!image) return null;
  const label = sts1IntentDamageLabel(tier);
  const stage = size === "stage";
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${stage ? "h-16 w-16" : "h-9 w-9"}`}>
      <Image
        src={sts1IntentImageUrl(image)}
        alt=""
        width={stage ? 64 : 36}
        height={stage ? 64 : 36}
        className={`object-contain ${stage ? "h-16 w-16 drop-shadow-[0_5px_6px_rgba(0,0,0,0.78)]" : "h-9 w-9"}`}
      />
      {label ? (
        <span
          className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-game-title font-black leading-none text-[#fff8db] ${stage ? "-bottom-1 text-xl" : "-bottom-0.5 text-[11px]"}`}
          style={{ textShadow: NUMBER_SHADOW }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

function AllyBadge({ text }: { text: DetailText }) {
  return <span className="rounded bg-white/10 px-1 text-[10px] font-bold text-gray-300">{text.ally}</span>;
}

function EffectTokens({
  effects,
  refs,
  text,
}: {
  effects: Sts1MonsterEffects;
  refs: Sts1MonsterRefs;
  text: DetailText;
}) {
  const items: ReactNode[] = [];
  effects.block?.forEach((row, index) => {
    items.push(
      <span key={`block-${index}`} className="inline-flex items-center gap-1 font-game-text text-sm font-bold text-gray-100">
        <Image src={sts1UiImageUrl("block")} alt="" width={22} height={22} className="h-5 w-5 object-contain" />
        {formatSts1Amount(row.amount)}
        {row.target === "ally" ? <AllyBadge text={text} /> : null}
      </span>,
    );
  });
  effects.powers?.forEach((row, index) => {
    const power = refs.powers[row.power];
    const amount = row.amount == null ? null : formatSts1Amount(row.amount);
    const negative = typeof row.amount === "number" && row.amount < 0;
    const icon = (
      <span className="relative inline-flex h-7 w-7 items-center justify-center">
        {power ? (
          <Image src={sts1PowerImageUrl(power)} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
        ) : (
          <span className="text-[10px] text-gray-400">{row.power}</span>
        )}
        {amount ? (
          <span
            className={`pointer-events-none absolute -bottom-1 -right-1 font-game-title text-xs font-black leading-none ${negative ? "text-[#ff6563]" : "text-[#fff8db]"}`}
            style={{ textShadow: NUMBER_SHADOW }}
          >
            {amount}
          </span>
        ) : null}
      </span>
    );
    items.push(
      <span key={`power-${index}`} className="inline-flex items-center gap-1">
        {power ? (
          <Sts1MentionHover
            entityId={`sts1:powers:${power.slug}`}
            text={power.name}
            className="relative inline-flex cursor-help"
            linkClassName="inline-flex rounded-sm outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            {icon}
          </Sts1MentionHover>
        ) : icon}
        {row.target === "ally" ? <AllyBadge text={text} /> : null}
      </span>,
    );
  });
  effects.cards?.forEach((row, index) => {
    const card = refs.cards[row.card];
    items.push(
      <span key={`card-${index}`} className="inline-flex items-center gap-1 text-xs text-gray-400">
        {card ? <Sts1MentionHover entityId={`sts1:cards:${card.slug}`} text={card.name} /> : row.card}
        <span className="font-bold text-gray-200">×{row.amount}</span>
        <span>→ {text.piles[row.pile]}</span>
      </span>,
    );
  });
  effects.heal?.forEach((row, index) => {
    items.push(
      <span key={`heal-${index}`} className="inline-flex items-center gap-1 font-game-text text-xs font-bold text-[#7fff00]">
        {text.heal} {formatSts1Amount(row.amount)}
        {row.target === "ally" ? <AllyBadge text={text} /> : null}
      </span>,
    );
  });
  if (effects.summons?.length) {
    const counts = new Map<string, number>();
    for (const id of effects.summons) counts.set(id, (counts.get(id) ?? 0) + 1);
    items.push(
      <span key="summons" className="inline-flex flex-wrap items-center gap-1 text-xs text-gray-400">
        {text.summon}
        {[...counts].map(([id, count]) => {
          const monster = refs.monsters[id];
          return (
            <span key={id} className="inline-flex items-center gap-0.5">
              {monster ? <Sts1MentionHover entityId={`sts1:monsters:${monster.slug}`} text={monster.name} /> : id}
              {count > 1 ? <span className="font-bold text-gray-200">×{count}</span> : null}
            </span>
          );
        })}
      </span>,
    );
  }
  if (effects.flags?.includes("suicide")) {
    items.push(<span key="dies" className="text-xs font-bold text-[#ff6563]">{text.dies}</span>);
  }
  if (items.length === 0) return null;
  return <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">{items}</span>;
}

function MoveButton({
  move,
  tier,
  selected,
  labels,
  refs,
  text,
  serviceLocale,
  onPlay,
  onPreview,
}: {
  move: Sts1MonsterMove;
  tier: Sts1MonsterMoveTier;
  selected: boolean;
  labels: Sts1UiLabels;
  refs: Sts1MonsterRefs;
  text: DetailText;
  serviceLocale: ServiceLocale;
  onPlay: () => void;
  onPreview: (active: boolean) => void;
}) {
  const intentName = labels.monsters.intents[tier.intent ?? "UNKNOWN"];
  const title = move.name ?? intentName;
  const subtitle = move.name
    ? (serviceLocale === "ko" && move.nameEn && move.nameEn !== move.name ? move.nameEn : null)
    : prettyKey(move.key);
  return (
    <button
      type="button"
      onClick={onPlay}
      onMouseEnter={() => onPreview(true)}
      onMouseLeave={() => onPreview(false)}
      onFocus={() => onPreview(true)}
      onBlur={() => onPreview(false)}
      className="w-full rounded-md border px-2.5 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
      style={{
        backgroundColor: selected ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.015)",
        borderColor: selected ? "rgba(239,200,81,0.65)" : "rgba(255,255,255,0.06)",
      }}
      data-sts1-move={move.id}
    >
      <span className="flex items-start gap-2.5">
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span>
            <span className={`block truncate font-game-title text-sm font-semibold ${move.name ? "text-gray-100" : "text-gray-300"}`}>
              {title}
            </span>
            {subtitle ? <span className="block truncate font-game-text text-[11px] text-gray-500">{subtitle}</span> : null}
          </span>
          <EffectTokens effects={tier} refs={refs} text={text} />
        </span>
        <IntentToken tier={tier} size="chip" />
      </span>
    </button>
  );
}

export function Sts1MonsterDetail({
  monster,
  refs,
  labels,
  serviceLocale,
  onClose,
}: {
  monster: Sts1Monster;
  refs: Sts1MonsterRefs;
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
  onClose?: () => void;
}) {
  const assetCopyTargetRef = useRef<HTMLDivElement>(null);
  const text = detailText(serviceLocale);
  const dungeon = labels.monsters.dungeons[monster.dungeon];
  const [ascension, setAscension] = useMonsterAscensionLevel(STS1_MONSTER_ASCENSION_SCOPE);
  const [playback, setPlayback] = useState<Sts1MonsterPlayback | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const hitPoints = hitPointsAt(monster, ascension);
  const hpLabel = hitPoints ? `${hitPointRange(hitPoints)}/${hitPointRange(hitPoints)}` : null;
  const shownMove = monster.moves.find((move) => move.id === previewId) ?? playback?.move ?? null;
  const shownTier = shownMove ? tierAt(shownMove.tiers, ascension) : undefined;
  const starting = tierAt(monster.startingEffects, ascension);

  return (
    <Sts1DetailShell
      backHref={sts1IndexPath("monsters")}
      backLabel={labels.monstersTitle}
      onClose={onClose}
      serviceLocale={serviceLocale}
      heroLayout="icon"
      assetActions={(
        <CompendiumAssetImageActions
          serviceLocale={serviceLocale}
          fileName={`${monster.slug}.png`}
          targetRef={assetCopyTargetRef}
        />
      )}
      hero={(
        <Sts1MonsterStage
          monster={monster}
          playback={playback}
          captureRef={assetCopyTargetRef}
          intent={shownTier ? <IntentToken tier={shownTier} size="stage" /> : null}
          hpLabel={hpLabel}
          overlay={(
            <MonsterAscensionStepper
              level={ascension}
              onChange={setAscension}
              serviceLocale={serviceLocale}
              maxLevel={STS1_MONSTER_ASCENSION_SCOPE.maxLevel}
              iconSrc={sts1UiImageUrl("ascension")}
              prominent
            />
          )}
        />
      )}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <h1 className="font-game-title text-2xl text-primary">{monster.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Sts1MetaPill
            value={labels.monsters.types[monster.type]}
            color={STS1_MONSTER_TYPE_COLORS[monster.type]}
          />
          <Sts1MetaPill value={`${dungeon.act} ${dungeon.name}`} />
        </div>
        <div className="mt-3">
          <Sts1EnglishName name={monster.name} nameEn={monster.nameEn} serviceLocale={serviceLocale} />
        </div>
      </section>
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          {labels.monsters.hitPoints}
        </div>
        <dl className="flex flex-col gap-1 font-game-text text-sm text-foreground">
          {monster.hitPoints.map((tier) => (
            <div
              key={tier.ascension}
              className={`flex items-center justify-between gap-3 rounded px-1.5 ${tier.ascension === hitPoints?.ascension ? "bg-white/[0.06]" : ""}`}
            >
              <dt className="text-muted-foreground">
                {tier.ascension > 0 ? `${labels.monsters.ascension} ${tier.ascension}+` : text.base}
              </dt>
              <dd className="font-bold">{hitPointRange(tier)}</dd>
            </div>
          ))}
        </dl>
      </section>
      {starting && Object.keys(starting).length > 1 ? (
        <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">{text.startingEffects}</div>
          <EffectTokens effects={starting} refs={refs} text={text} />
        </section>
      ) : null}
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">{text.moves}</div>
        {monster.moves.length > 0 ? (
          <div className="space-y-1.5">
            {monster.moves.map((move) => {
              const tier = tierAt(move.tiers, ascension);
              if (!tier) return null;
              return (
                <MoveButton
                  key={move.id}
                  move={move}
                  tier={tier}
                  selected={playback?.move.id === move.id}
                  labels={labels}
                  refs={refs}
                  text={text}
                  serviceLocale={serviceLocale}
                  onPlay={() => setPlayback((current) => ({ move, nonce: (current?.nonce ?? 0) + 1 }))}
                  onPreview={(active) => setPreviewId((current) => (active ? move.id : current === move.id ? null : current))}
                />
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{text.noMoves}</p>
        )}
      </section>
      <Sts1CommentsRail
        resourceType="monster"
        slug={monster.slug}
        serviceLocale={serviceLocale}
      />
    </Sts1DetailShell>
  );
}

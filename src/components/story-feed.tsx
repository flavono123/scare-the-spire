"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Story, Card, Change, Relic, Potion } from "@/lib/types";

function DiffLine({ diff }: { diff: Change["diffs"][0] }) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      {diff.upgraded && (
        <span className="text-[10px] font-medium text-green-400 bg-green-500/10 rounded px-1">+</span>
      )}
      <span className="text-muted-foreground">{diff.displayName}</span>
      <span className="text-red-400 font-medium">{String(diff.before)}</span>
      <span className="text-muted-foreground">→</span>
      <span className="text-green-400 font-medium">{String(diff.after)}</span>
    </div>
  );
}

function EntityInfo({ story, card, relic, potion }: { story: Story; card?: Card; relic?: Relic; potion?: Potion }) {
  if (story.entityType === "card" && card) {
    return (
      <Link href={`/cards/${card.id}`} className="flex gap-3 items-start group">
        <Image
          src={`/images/cards/${card.id}.webp`}
          alt={card.name}
          width={85}
          height={110}
          className="rounded-md shrink-0 group-hover:scale-105 transition-transform"
        />
        <div>
          <p className="font-medium group-hover:text-yellow-500 transition-colors">{card.nameKo}</p>
          <p className="text-xs text-muted-foreground">{card.name}</p>
        </div>
      </Link>
    );
  }
  if (story.entityType === "relic" && relic) {
    return (
      <Link href={`/relics/${relic.id}`} className="flex gap-3 items-start group">
        <Image
          src={`/images/relics/${relic.id}.webp`}
          alt={relic.name}
          width={48}
          height={48}
          className="shrink-0 group-hover:scale-110 transition-transform"
        />
        <div>
          <p className="font-medium group-hover:text-yellow-500 transition-colors">{relic.nameKo}</p>
          <p className="text-xs text-muted-foreground">{relic.name}</p>
        </div>
      </Link>
    );
  }
  if (story.entityType === "potion" && potion) {
    return (
      <Link href={`/potions/${potion.id}`} className="flex gap-3 items-start group">
        <Image
          src={`/images/potions/${potion.id}.webp`}
          alt={potion.name}
          width={48}
          height={48}
          className="shrink-0 group-hover:scale-110 transition-transform"
        />
        <div>
          <p className="font-medium group-hover:text-yellow-500 transition-colors">{potion.nameKo}</p>
          <p className="text-xs text-muted-foreground">{potion.name}</p>
        </div>
      </Link>
    );
  }
  return null;
}

function ChangeDetail({ change, story, card, relic, potion }: { change: Change; story: Story; card?: Card; relic?: Relic; potion?: Potion }) {
  const baseDiffs = change.diffs.filter((d) => !d.upgraded);
  const upgradedDiffs = change.diffs.filter((d) => d.upgraded);

  return (
    <div className="space-y-3">
      <EntityInfo story={story} card={card} relic={relic} potion={potion} />

      {/* Patch info */}
      <div className="rounded-lg border border-border bg-card/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-yellow-500">{change.patch}</span>
          {change.date && (
            <span className="text-xs text-muted-foreground">{change.date}</span>
          )}
        </div>
        {change.summary && (
          <p className="text-xs text-muted-foreground mb-2">{change.summary}</p>
        )}
        <div className="space-y-1">
          {baseDiffs.map((d, i) => (
            <DiffLine key={i} diff={d} />
          ))}
          {upgradedDiffs.length > 0 && (
            <div className="mt-1.5 border-l-2 border-green-500/30 pl-2 space-y-1">
              {upgradedDiffs.map((d, i) => (
                <DiffLine key={i} diff={d} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StoryCard({
  story,
  card,
  relic,
  potion,
  change,
}: {
  story: Story;
  card?: Card;
  relic?: Relic;
  potion?: Potion;
  change?: Change;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="border-b border-border/50 last:border-b-0">
      <div className="px-4 py-6">
        {/* Sentence */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full"
        >
          <p className="text-lg sm:text-xl font-medium leading-snug text-center">
            &ldquo;{story.sentence}&rdquo;
          </p>
        </button>

        {/* Expanded: tags, engagement, card, change detail */}
        {expanded && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span>♥ 0</span>
              <span>💬 0</span>
              {story.tags && story.tags.length > 0 &&
                story.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-zinc-800 px-2 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
            </div>
            {change && <ChangeDetail change={change} story={story} card={card} relic={relic} potion={potion} />}
          </div>
        )}
      </div>
    </article>
  );
}

export function StoryFeed({
  stories,
  cards,
  relics,
  potions,
  changes,
}: {
  stories: Story[];
  cards: Card[];
  relics: Relic[];
  potions: Potion[];
  changes: Change[];
}) {
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const relicMap = new Map(relics.map((r) => [r.id, r]));
  const potionMap = new Map(potions.map((p) => [p.id, p]));
  const changeMap = new Map(changes.map((c) => [c.id, c]));

  return (
    <div className="divide-y divide-border/50">
      {stories.map((story) => (
        <StoryCard
          key={story.id}
          story={story}
          card={cardMap.get(story.entityId)}
          relic={relicMap.get(story.entityId)}
          potion={potionMap.get(story.entityId)}
          change={changeMap.get(story.changeId)}
        />
      ))}
    </div>
  );
}

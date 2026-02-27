"use client";

import { useState } from "react";
import Image from "next/image";
import type { Story, Card, Change } from "@/lib/types";

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

function ChangeDetail({ change, card }: { change: Change; card?: Card }) {
  const baseDiffs = change.diffs.filter((d) => !d.upgraded);
  const upgradedDiffs = change.diffs.filter((d) => d.upgraded);

  return (
    <div className="space-y-3">
      {/* Card info */}
      {card && (
        <div className="flex gap-3 items-start">
          <Image
            src={`/images/cards/${card.id}.webp`}
            alt={card.name}
            width={85}
            height={110}
            className="rounded-md shrink-0"
          />
          <div>
            <p className="font-medium">{card.nameKo}</p>
            <p className="text-xs text-muted-foreground">{card.name}</p>
          </div>
        </div>
      )}

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
  change,
}: {
  story: Story;
  card?: Card;
  change?: Change;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="border-b border-border/50 last:border-b-0">
      <div className="px-4 py-5">
        {/* Sentence + engagement */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left"
        >
          <p className="text-lg sm:text-xl font-medium leading-snug">
            &ldquo;{story.sentence}&rdquo;
          </p>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span>♥ 0</span>
            <span>💬 0</span>
            {story.tags && story.tags.length > 0 && (
              <div className="flex gap-1.5 ml-auto">
                {story.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-zinc-800 px-2 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>

        {/* Expanded: card + change detail */}
        {expanded && change && (
          <div className="mt-4">
            <ChangeDetail change={change} card={card} />
          </div>
        )}
      </div>
    </article>
  );
}

export function StoryFeed({
  stories,
  cards,
  changes,
}: {
  stories: Story[];
  cards: Card[];
  changes: Change[];
}) {
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const changeMap = new Map(changes.map((c) => [c.id, c]));

  return (
    <div className="divide-y divide-border/50">
      {stories.map((story) => (
        <StoryCard
          key={story.id}
          story={story}
          card={cardMap.get(story.entityId)}
          change={changeMap.get(story.changeId)}
        />
      ))}
    </div>
  );
}

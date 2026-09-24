"use client";

import { type CSSProperties } from "react";
import { ColorfulPhilosopherReactionIcon } from "@/components/colorful-philosophers/reaction-icon";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { SPIRE_ACTION_CONTROL_CLASS } from "@/components/spire-icon";
import { useAuth } from "@/hooks/use-auth";
import { useResourceReactions } from "@/hooks/use-resource-reactions";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  COLORFUL_PHILOSOPHER_REACTIONS,
  type ColorfulPhilosopherReaction,
} from "@/lib/colorful-philosophers";
import { serviceMessages } from "@/messages/service";
import { cn } from "@/lib/utils";

function ReactionWords({ kind, label }: { kind: ColorfulPhilosopherReaction; label: string }) {
  if (kind === "buff") {
    return (
      <span className="rich-sine font-semibold text-[#34d399]">
        {Array.from(label).map((letter, index) => (
          <span key={`${letter}-${index}`} className="rich-sine-letter" style={{ "--rich-sine-index": index } as CSSProperties}>
            {letter}
          </span>
        ))}
      </span>
    );
  }
  if (kind === "nerf") return <span className="rich-jitter font-semibold text-[#f87171]">{label}</span>;
  return <span className="font-semibold text-[#EFC851]">{label}</span>;
}

export function ResourceReactionBar({
  resourceType,
  resourceId,
  gameVersion,
}: {
  resourceType: string;
  resourceId: string;
  gameVersion: string;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].colorfulPhilosophers;
  const { userId, ensureUser } = useAuth();
  const resource = useResourceReactions(resourceType, resourceId, gameVersion);

  return (
    <div className="flex flex-wrap gap-2">
      {COLORFUL_PHILOSOPHER_REACTIONS.map((kind) => {
        const active = resource.kind === kind;
        const tip = active ? copy.reactionClear[kind] : copy.reactions[kind];
        return (
          <GameUiHoverTip key={kind} label={tip}>
            <button
              type="button"
              aria-pressed={active}
              aria-label={tip}
              onClick={() => {
                void (async () => {
                  const activeUserId = userId ?? await ensureUser();
                  if (!activeUserId) return;
                  await resource.choose(kind, activeUserId);
                })();
              }}
              className={cn(
                SPIRE_ACTION_CONTROL_CLASS,
                "gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                kind === "buff" && (active ? "border-[#34d399] bg-[#34d399]/15" : "border-white/10 hover:border-[#34d399]/70"),
                kind === "nerf" && (active ? "border-[#f87171] bg-[#f87171]/15" : "border-white/10 hover:border-[#f87171]/70"),
                kind === "rework" && (active ? "border-[#EFC851] bg-[#EFC851]/15" : "border-white/10 hover:border-[#EFC851]/70"),
              )}
            >
              <ColorfulPhilosopherReactionIcon kind={kind} active={active} lift size={18} />
              <ReactionWords kind={kind} label={copy.reactions[kind]} />
              <span className="tabular-nums text-zinc-400">{resource.counts[kind]}</span>
            </button>
          </GameUiHoverTip>
        );
      })}
    </div>
  );
}

"use client";

import { useState } from "react";
import Image from "@/components/ui/static-image";
import { STS1_MONSTER_TYPE_COLORS } from "@/lib/sts1/card-style";
import { sts1MonsterImageUrl } from "@/lib/sts1/paths";
import type { Sts1Monster } from "@/lib/sts1/types";
import { Sts1MonsterStage, type Sts1MonsterPlayback } from "./monster-stage";

/** Like the STS2 index: hovering plays one of the monster's moves, picked at random. */
function randomPreview(monster: Sts1Monster): Sts1MonsterPlayback | null {
  const timed = monster.moves.filter((move) => monster.vfx?.moves[String(move.id)]?.length);
  const pool = timed.length ? timed : monster.moves;
  const move = pool[Math.floor(Math.random() * pool.length)];
  return move ? { move, nonce: 1 } : null;
}

export function Sts1MonsterTile({ monster }: { monster: Sts1Monster }) {
  const [preview, setPreview] = useState<Sts1MonsterPlayback | null | undefined>(undefined);
  const hovering = preview !== undefined;
  return (
    <div
      className="flex h-full flex-col items-center gap-2 rounded-lg border border-border bg-compendium-rail p-3 transition-colors group-hover:border-primary/60 group-hover:bg-white/[0.04]"
      onMouseEnter={() => setPreview(randomPreview(monster))}
      onMouseLeave={() => setPreview(undefined)}
    >
      <div className="relative flex h-28 w-full items-center justify-center">
        <Image
          src={sts1MonsterImageUrl(monster)}
          alt={monster.name}
          width={144}
          height={112}
          loading="lazy"
          className={`max-h-full max-w-full object-contain ${hovering ? "opacity-0" : ""}`}
          style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))" }}
        />
        {hovering ? (
          <Sts1MonsterStage
            monster={monster}
            playback={preview}
            variant="tile"
            className="absolute inset-0 overflow-hidden"
          />
        ) : null}
      </div>
      <span
        className="text-center font-game-text text-sm font-bold"
        style={{ color: STS1_MONSTER_TYPE_COLORS[monster.type] }}
      >
        {monster.name}
      </span>
    </div>
  );
}

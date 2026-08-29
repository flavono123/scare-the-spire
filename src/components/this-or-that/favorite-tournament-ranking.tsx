"use client";

import type { EntityInfo } from "@/components/patch-note-renderer";
import Image from "@/components/ui/static-image";
import { resourceKey } from "@/lib/decisions-decisions";
import {
  championshipRate,
  entityForRef,
  formatPercent,
  matchWinRate,
  rankedCandidateStats,
  type FavoriteTournamentCandidateStats,
  type FavoriteTournamentPost,
} from "@/lib/favorite-tournament";
import type { ServiceLocale } from "@/lib/i18n";
import { relicAwareImageUrl } from "@/lib/relic-character-variant";
import { serviceMessages } from "@/messages/service";
import { useStoredUserProfile } from "@/hooks/use-user-profile";

export function FavoriteTournamentRanking({
  post,
  stats,
  entityMap,
  serviceLocale,
}: {
  post: FavoriteTournamentPost;
  stats: FavoriteTournamentCandidateStats[];
  entityMap: Map<string, EntityInfo>;
  serviceLocale: ServiceLocale;
}) {
  const copy = serviceMessages[serviceLocale].favoriteTournament;
  const profile = useStoredUserProfile();
  const playCount = post.play_count ?? 0;
  const ranked = rankedCandidateStats(stats);

  if (playCount <= 0 || ranked.length === 0) {
    return <p className="text-sm text-muted-foreground">{copy.rankingEmpty}</p>;
  }

  return (
    <section className="space-y-3">
      <h2 className="font-service text-sm font-semibold text-zinc-300">{copy.rankingTitle}</h2>
      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="bg-white/5 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">{copy.rankingCandidate}</th>
              <th className="px-3 py-2 font-medium">
                {copy.rankingChampionship}
                <span className="mt-0.5 block font-normal text-[10px]">{copy.rankingChampionshipHint}</span>
              </th>
              <th className="px-3 py-2 font-medium">
                {copy.rankingWinRate}
                <span className="mt-0.5 block font-normal text-[10px]">{copy.rankingWinRateHint}</span>
              </th>
              <th className="px-3 py-2 font-medium">{copy.rankingTrend}</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row, index) => {
              const ref = { type: row.resource_type, id: row.resource_id };
              const entity = entityForRef(ref, entityMap);
              const name = entity?.nameKo ?? row.resource_id;
              const imageUrl = relicAwareImageUrl(entity, profile.characterId);
              const trend = row.rank_history
                .slice(-6)
                .map((snap) => `${snap.rank}`)
                .join(" → ");
              return (
                <tr key={resourceKey(ref)} className="border-t border-border/50">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt=""
                          width={28}
                          height={28}
                          className="h-7 w-7 object-contain"
                        />
                      ) : null}
                      <span className="font-game-title text-zinc-100">{name}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatPercent(championshipRate(row.championships, playCount))}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatPercent(matchWinRate(row.match_wins, row.match_appearances))}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {trend || String(row.current_rank ?? index + 1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
